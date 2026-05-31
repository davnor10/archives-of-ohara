import { execFile, spawn } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

function getFfmpegPath(): string {
  // Production: binary copied into app resources
  if (app.isPackaged) {
    const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
    const bundled = join(process.resourcesPath, exe)
    if (existsSync(bundled)) return bundled
    console.error('[ffmpeg] Bundled binary not found at:', bundled)
  }
  // Dev: use ffmpeg-static from node_modules
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const p = require('ffmpeg-static') as string
    if (p && existsSync(p)) return p
  } catch { /* not installed */ }
  // Last resort: system ffmpeg
  return 'ffmpeg'
}

export interface MediaStream {
  index: number        // stream index within the file (e.g. 0, 1, 2)
  codecType: 'video' | 'audio' | 'subtitle'
  codecName: string
  lang?: string
}

function parseStreams(stderr: string): MediaStream[] {
  const streams: MediaStream[] = []
  // Match lines like: Stream #0:0(eng): Video: hevc (Main), ...
  //                   Stream #0:1(jpn): Audio: dts (DTS), ...
  //                   Stream #0:2: Subtitle: subrip, ...
  const re = /Stream #\d+:(\d+)(?:\(([^)]+)\))?\s*(?:\[.*?\])?\s*:\s*(Video|Audio|Subtitle):\s*(\w+)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(stderr)) !== null) {
    streams.push({
      index: parseInt(m[1]),
      codecType: m[3].toLowerCase() as MediaStream['codecType'],
      codecName: m[4].toLowerCase(),
      lang: m[2]
    })
  }
  return streams
}

// Probe result cache so we only run ffmpeg once per file
const _probeCache = new Map<string, MediaStream[]>()
const _durationCache = new Map<string, number>()

function parseDuration(stderr: string): number {
  const m = stderr.match(/Duration:\s+(\d+):(\d+):(\d+(?:\.\d+)?)/)
  if (!m) return 0
  return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3])
}

export async function getCachedStreams(filePath: string): Promise<MediaStream[]> {
  if (_probeCache.has(filePath)) return _probeCache.get(filePath)!
  const streams = await probeStreams(filePath)
  _probeCache.set(filePath, streams)
  return streams
}

export async function getCachedDuration(filePath: string): Promise<number> {
  if (_durationCache.has(filePath)) return _durationCache.get(filePath)!
  await getCachedStreams(filePath)
  return _durationCache.get(filePath) ?? 0
}

// Returns all streams in a file. Runs ffmpeg -i which exits with error (but outputs info to stderr).
export function probeStreams(filePath: string): Promise<MediaStream[]> {
  return new Promise((resolve) => {
    execFile(getFfmpegPath(), ['-hide_banner', '-i', filePath], (_err, _stdout, stderr) => {
      // ffmpeg always exits non-zero when no output is specified; stderr has the info
      if (stderr.includes('No such file or directory')) {
        console.warn('[ffmpeg] File not found during probe:', filePath)
      }
      const dur = parseDuration(stderr)
      if (dur > 0) _durationCache.set(filePath, dur)
      resolve(parseStreams(stderr))
    })
  })
}

const NATIVE_VIDEO = new Set(['h264', 'avc', 'vp8', 'vp9', 'theora', 'av1'])
const NATIVE_AUDIO = new Set(['aac', 'mp3', 'flac', 'vorbis', 'opus', 'pcm_s16le', 'pcm_u8', 'mp2'])

export function needsTranscode(streams: MediaStream[], audioIdx = 0): boolean {
  const video = streams.find((s) => s.codecType === 'video')
  const audioStreams = streams.filter((s) => s.codecType === 'audio')
  const audio = audioStreams[audioIdx] ?? audioStreams[0]

  // If ffmpeg ran but found nothing, the codec is unknown — transcode rather than risk SRC_NOT_SUPPORTED
  if (!video && audioStreams.length === 0) return true

  const badVideo = video ? !NATIVE_VIDEO.has(video.codecName) : false
  const badAudio = audio ? !NATIVE_AUDIO.has(audio.codecName) : false
  const trackSwitch = audioIdx > 0

  return !!(badVideo || badAudio || trackSwitch)
}

export interface TranscodeOpts {
  audioIdx?: number    // 0-based index among audio streams
  startSec?: number
}

// H.264 can be stream-copied into frag-MP4 cleanly. HEVC/AV1/VP9 cannot — Chromium's media
// pipeline requires hardware decode support for those, which is not guaranteed on all systems.
// Re-encode to H.264 instead, using -hwaccel auto to GPU-accelerate the input decode.
const COPY_VIDEO = new Set(['h264', 'avc', 'av1'])

// Spawns ffmpeg transcoding to fragmented MP4 piped to stdout.
export function spawnTranscode(filePath: string, opts: TranscodeOpts = {}, streams?: MediaStream[]) {
  const { audioIdx = 0, startSec } = opts
  const args: string[] = ['-hide_banner', '-loglevel', 'error']

  const videoCodec = streams?.find((s) => s.codecType === 'video')?.codecName ?? ''
  const willCopy = COPY_VIDEO.has(videoCodec)

  // Hardware-accelerate input decoding when re-encoding (HEVC→H.264 etc.).
  // Falls back to software silently if no hardware decoder is available.
  if (!willCopy) args.push('-hwaccel', 'auto')

  if (startSec && startSec > 0) args.push('-ss', String(startSec))
  args.push('-i', filePath)
  args.push('-map', '0:v:0')
  args.push('-map', `0:a:${audioIdx}?`) // ? = skip silently if audio track is absent

  if (willCopy) {
    args.push('-c:v', 'copy')
  } else {
    // ultrafast uses ~3x less CPU than veryfast — safe for real-time HEVC decode + H.264 encode
    // -g 48: keyframe every 48 frames (~2 s at 24 fps) so frag_keyframe creates small fragments
    // without this libx264 defaults to keyint=250 (~10 s) which causes visible 10-second jumps
    args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-preset', 'ultrafast',
      '-g', '48', '-keyint_min', '24', '-threads', '2')
  }

  args.push('-c:a', 'aac', '-b:a', '192k', '-ac', '2')
  // frag_keyframe: one MP4 fragment per keyframe — required for streaming to <video>
  // default_base_moof: correct base-data-offset in each fragment for seeks
  // No empty_moov: moov is written after encoder init so avcC contains real SPS/PPS.
  // empty_moov writes a placeholder avcC before the encoder starts; Chromium may
  // reject the placeholder codec config and fire SRC_NOT_SUPPORTED.
  args.push('-movflags', 'frag_keyframe+default_base_moof')
  args.push('-f', 'mp4', 'pipe:1')

  const proc = spawn(getFfmpegPath(), args, { stdio: ['ignore', 'pipe', 'pipe'] })
  // Drain stderr so a full pipe buffer never stalls the ffmpeg process
  proc.stderr?.resume()
  proc.on('close', (code) => {
    if (code !== 0 && code !== null) console.error('[ffmpeg] Transcode exited with code', code, filePath)
  })
  return proc
}

// Extracts subtitle stream by its stream index, returns WebVTT string
export function extractSubtitle(filePath: string, streamIndex: number): Promise<string | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    const proc = spawn(
      getFfmpegPath(),
      [
        '-hide_banner', '-loglevel', 'error',
        '-i', filePath,
        '-map', `0:${streamIndex}`,
        '-c:s', 'webvtt',
        '-f', 'webvtt',
        'pipe:1'
      ],
      { stdio: ['ignore', 'pipe', 'ignore'] }
    )
    proc.stdout.on('data', (c: Buffer) => chunks.push(c))
    proc.on('close', () => {
      const text = Buffer.concat(chunks).toString('utf-8')
      resolve(text.trim() ? text : null)
    })
    proc.on('error', (err) => {
      console.error('[ffmpeg] extractSubtitle spawn error:', err)
      resolve(null)
    })
  })
}
