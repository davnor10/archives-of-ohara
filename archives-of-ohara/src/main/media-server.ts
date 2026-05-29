import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import { getCachedStreams, needsTranscode, spawnTranscode } from './ffmpeg'

const VIDEO_EXTS = new Set(['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.m4v', '.ts', '.m2ts', '.webm'])

function mime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const map: Record<string, string> = {
    '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.webm': 'video/webm',
    '.avi': 'video/x-msvideo', '.mov': 'video/quicktime', '.m4v': 'video/mp4',
    '.wmv': 'video/x-ms-wmv', '.ts': 'video/mp2t', '.m2ts': 'video/mp2t',
    '.vtt': 'text/vtt', '.srt': 'text/plain',
  }
  return map[ext] ?? 'application/octet-stream'
}

export function startMediaServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const urlObj = new URL(req.url ?? '/', 'http://localhost')
        const filePath = urlObj.searchParams.get('path') ?? ''
        const audioIdx = parseInt(urlObj.searchParams.get('audioIdx') ?? '0', 10) || 0

        // Allow renderer (any origin) to fetch from this local server
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD')
        if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

        if (!filePath || !fs.existsSync(filePath)) {
          res.writeHead(404); res.end(); return
        }

        const ext = path.extname(filePath).toLowerCase()

        // For video files: check codecs and transcode if needed
        if (VIDEO_EXTS.has(ext)) {
          try {
            const streams = await getCachedStreams(filePath)
            if (needsTranscode(streams, audioIdx)) {
              const proc = spawnTranscode(filePath, { audioIdx })
              res.writeHead(200, { 'Content-Type': 'video/mp4', 'Transfer-Encoding': 'chunked' })
              proc.stdout.pipe(res)
              req.on('close', () => { try { proc.kill() } catch { /* ignore */ } })
              return
            }
          } catch { /* ffmpeg unavailable — fall through to direct serve */ }
        }

        // Direct serve with full range-request support (enables seeking)
        const stat = fs.statSync(filePath)
        const range = req.headers['range']

        if (range) {
          const m = range.match(/bytes=(\d*)-(\d*)/)
          if (!m) { res.writeHead(416); res.end(); return }
          const start = m[1] ? parseInt(m[1], 10) : 0
          const end   = m[2] ? parseInt(m[2], 10) : stat.size - 1
          res.writeHead(206, {
            'Content-Range':  `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges':  'bytes',
            'Content-Length': String(end - start + 1),
            'Content-Type':   mime(filePath),
          })
          fs.createReadStream(filePath, { start, end }).pipe(res)
        } else {
          res.writeHead(200, {
            'Content-Length': String(stat.size),
            'Content-Type':   mime(filePath),
            'Accept-Ranges':  'bytes',
          })
          fs.createReadStream(filePath).pipe(res)
        }
      } catch (err) {
        if (!res.headersSent) { res.writeHead(500); res.end(String(err)) }
      }
    })

    server.listen(0, '127.0.0.1', () => {
      resolve((server.address() as { port: number }).port)
    })
    server.on('error', reject)
  })
}
