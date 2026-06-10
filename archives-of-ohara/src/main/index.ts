import { app, shell, BrowserWindow, ipcMain, dialog, protocol, nativeImage } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join, dirname, basename, extname } from 'path'
import { readdirSync, readFileSync, existsSync, statSync, createReadStream } from 'fs'
import db from './db'
import { scanMedia, cleanOrphans } from './scanner'
import { fetchTmdbMetadata, searchTmdb, applyTmdbEntry } from './tmdb'
import { extractSubtitle, getCachedStreams, getCachedDuration, needsTranscode, spawnTranscode } from './ffmpeg'
import type { TranscodeOpts } from './ffmpeg'

// Enable hardware HEVC decoding where the GPU supports it
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport')
app.commandLine.appendSwitch('enable-gpu-rasterization')
// Allow video autoplay without requiring a user gesture each time
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }
])

const VIDEO_EXTS = new Set(['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.m4v', '.ts', '.m2ts', '.webm'])

// Containers Chromium cannot play natively — always transcode regardless of codec
// .mkv: Chromium's FFmpegDemuxer fails with PIPELINE_ERROR_READ on arbitrary MKV files
const ALWAYS_TRANSCODE_EXTS = new Set(['.mkv', '.avi', '.wmv', '.ts', '.m2ts', '.mov'])

const MIME_MAP: Record<string, string> = {
  '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.webm': 'video/webm',
  '.avi': 'video/x-msvideo', '.mov': 'video/quicktime', '.m4v': 'video/mp4',
  '.wmv': 'video/x-ms-wmv', '.ts': 'video/mp2t', '.m2ts': 'video/mp2t',
  '.vtt': 'text/vtt', '.srt': 'text/plain',
}


function nodeStreamToWeb<T extends NodeJS.ReadableStream>(
  nodeStream: T,
  onCancel?: () => void
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      nodeStream.on('data', (chunk: Buffer) => {
        try { controller.enqueue(new Uint8Array(chunk)) } catch { onCancel?.() }
      })
      nodeStream.on('end', () => { try { controller.close() } catch { /* already closed */ } })
      nodeStream.on('error', (err) => { try { controller.error(err) } catch { /* already closed */ } })
    },
    cancel() { onCancel?.() }
  })
}

// ── Subtitle helpers ─────────────────────────────────────────────────────────

export interface SubtitleFile {
  path: string
  label: string
  vttContent?: string
  streamIndex?: number
}

function srtToVtt(srt: string): string {
  return (
    'WEBVTT\n\n' +
    srt
      .replace(/\r\n/g, '\n')
      .replace(/^\d+\n/gm, '')
      .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
      .trim()
  )
}

function findExternalSubtitles(videoPath: string): SubtitleFile[] {
  const dir = dirname(videoPath)
  const base = basename(videoPath, extname(videoPath))
  const found: SubtitleFile[] = []
  const seen = new Set<string>()

  const addSub = (filePath: string) => {
    if (seen.has(filePath)) return
    seen.add(filePath)
    const fileExt = extname(filePath).toLowerCase()
    const fileBase = basename(filePath, fileExt)
    let label = fileBase.length > base.length
      ? fileBase.slice(base.length).replace(/^[._\s-]+/, '')
      : 'Default'
    if (!label) label = 'Default'
    const entry: SubtitleFile = { path: filePath, label }
    if (fileExt === '.srt') {
      try { entry.vttContent = srtToVtt(readFileSync(filePath, 'utf-8')) } catch { /* skip */ }
    } else if (fileExt === '.vtt') {
      try { entry.vttContent = readFileSync(filePath, 'utf-8') } catch { /* skip */ }
    }
    found.push(entry)
  }

  const scanDir = (dirPath: string, mustMatch: boolean) => {
    if (!existsSync(dirPath)) return
    try {
      for (const file of readdirSync(dirPath)) {
        const ext = extname(file).toLowerCase()
        if (ext !== '.vtt' && ext !== '.srt') continue
        const fileBase = basename(file, ext)
        if (!mustMatch || fileBase === base || fileBase.startsWith(base + '.') || fileBase.startsWith(base + '_')) {
          addSub(join(dirPath, file))
        }
      }
    } catch { /* ignore */ }
  }

  scanDir(dir, true)
  for (const sub of ['Subs', 'subs', 'Subtitles', 'subtitles']) scanDir(join(dir, sub), false)

  return found
}

// ── Window ───────────────────────────────────────────────────────────────────

function createWindow(): void {
  const iconPath = join(__dirname, '../../resources/icon.png')
  const icon = nativeImage.createFromPath(iconPath)

  const mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    show: false, frame: false, autoHideMenuBar: true,
    backgroundColor: '#0a1628', icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    mainWindow.maximize()
  })
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  if (process.platform === 'win32') app.setAppUserModelId('com.archives-of-ohara')

  // media:// — privileged custom scheme for all media and subtitle serving
  protocol.handle('media', async (request) => {
    try {
      const urlObj = new URL(request.url)
      const filePath = urlObj.searchParams.get('path') ?? ''
      const audioIdx = parseInt(urlObj.searchParams.get('audioIdx') ?? '0', 10) || 0
      const startSec = parseFloat(urlObj.searchParams.get('startSec') ?? '0') || 0

      if (!filePath || !existsSync(filePath)) {
        console.warn('[media] File not found:', filePath || '(no path in request)')
        return new Response('Not Found', { status: 404 })
      }

      const ext = extname(filePath).toLowerCase()

      // Video: probe and transcode if needed
      if (VIDEO_EXTS.has(ext)) {
        try {
          const streams = await getCachedStreams(filePath)

          // Cache duration in DB for selection screens (fire-and-forget)
          const dur = await getCachedDuration(filePath)
          if (dur > 0) {
            try {
              db.prepare('UPDATE episodes SET duration_seconds=? WHERE path=? AND duration_seconds IS NULL').run(dur, filePath)
              db.prepare("UPDATE media_items SET duration_seconds=? WHERE path=? AND duration_seconds IS NULL").run(dur, filePath)
            } catch { /* ignore */ }
          }

          if (ALWAYS_TRANSCODE_EXTS.has(ext) || needsTranscode(streams, audioIdx)) {
            const proc = spawnTranscode(filePath, { audioIdx, startSec } as TranscodeOpts, streams)
            // Collect stderr and count stdout bytes.
            // Only surface an error if < 64KB was produced — the ftyp box is ~24
            // bytes and is written before encoding starts, so a tiny byte count
            // means the encoder failed. Large output means the movie was playing
            // and the non-zero exit is just stream-close cleanup noise.
            const stderrBuf: Buffer[] = []
            let stdoutBytes = 0
            proc.stderr?.on('data', (c: Buffer) => stderrBuf.push(c))
            proc.stdout.on('data', (c: Buffer) => { stdoutBytes += c.length })
            proc.on('close', (code) => {
              if (code !== 0 && code !== null && stdoutBytes < 65536) {
                const detail = Buffer.concat(stderrBuf).toString('utf-8').trim()
                console.error('[ffmpeg] Transcode failed (code', code, ', output', stdoutBytes, 'bytes):', filePath, '\n', detail)
                BrowserWindow.getAllWindows()[0]?.webContents.send('transcode-error', detail || `ffmpeg exited with code ${code}`)
              }
            })
            const stream = nodeStreamToWeb(proc.stdout, () => { try { proc.kill() } catch { /* ignore */ } })
            return new Response(stream, {
              status: 200,
              headers: {
                'Content-Type': 'video/mp4',
                'Accept-Ranges': 'none',
                'Access-Control-Allow-Origin': '*',
              }
            })
          }
        } catch (err) {
          console.warn('[media] ffmpeg probe failed, falling back to direct serve:', filePath, String(err))
        }
      }

      // Direct file serve — stream with correct MIME type and full range-request support.
      const mimeType = MIME_MAP[ext] ?? 'application/octet-stream'
      if (!MIME_MAP[ext]) console.warn('[media] Unknown extension, serving as octet-stream:', ext, filePath)
      const stat = statSync(filePath)
      const rangeHeader = request.headers.get('range')

      if (rangeHeader) {
        const m = rangeHeader.match(/bytes=(\d*)-(\d*)/)
        if (!m) return new Response('Range Not Satisfiable', { status: 416 })
        const start = m[1] ? parseInt(m[1], 10) : 0
        const end   = m[2] ? parseInt(m[2], 10) : stat.size - 1
        return new Response(nodeStreamToWeb(createReadStream(filePath, { start, end })), {
          status: 206,
          headers: {
            'Content-Range':  `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges':  'bytes',
            'Content-Length': String(end - start + 1),
            'Content-Type':   mimeType,
            'Access-Control-Allow-Origin': '*',
          },
        })
      }

      return new Response(nodeStreamToWeb(createReadStream(filePath)), {
        status: 200,
        headers: {
          'Content-Length': String(stat.size),
          'Content-Type':   mimeType,
          'Accept-Ranges':  'bytes',
          'Access-Control-Allow-Origin': '*',
        },
      })
    } catch (err) {
      console.error('[media] Unhandled error serving request:', err)
      return new Response(String(err), { status: 500 })
    }
  })

  // Window controls
  ipcMain.on('window-minimize', () => BrowserWindow.getFocusedWindow()?.minimize())
  ipcMain.on('window-maximize', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return
    win.isMaximized() ? win.unmaximize() : win.maximize()
  })
  ipcMain.on('window-close', () => BrowserWindow.getFocusedWindow()?.close())
  ipcMain.on('set-zoom', (_e, factor: number) => {
    _e.sender.setZoomFactor(factor)
  })

  // Kept for API compatibility (no longer used for video src)
  ipcMain.handle('get-media-port', () => 0)

  // Settings
  ipcMain.handle('get-settings', () => {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
    const result: Record<string, unknown> = {}
    for (const row of rows) {
      try { result[row.key] = JSON.parse(row.value) } catch { result[row.key] = row.value }
    }
    return result
  })
  ipcMain.handle('save-settings', (_e, data: Record<string, unknown>) => {
    const upsert = db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)')
    db.transaction(() => {
      for (const [k, v] of Object.entries(data)) upsert.run(k, JSON.stringify(v))
    })()
  })

  ipcMain.handle('select-folder', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, { properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('scan-media', () => {
    const result = scanMedia()
    if (result.newEntries > 0) {
      fetchTmdbMetadata().catch((err) => console.error('[tmdb] Background fetch failed:', err))
    }
    return result
  })
  ipcMain.handle('clean-orphans', (_e, episodeIds: number[], movieIds: number[]) => {
    cleanOrphans(episodeIds, movieIds)
  })
  ipcMain.handle('fetch-tmdb', async () => {
    await fetchTmdbMetadata()
    return true
  })

  ipcMain.handle('get-media', (_e, type: 'movie' | 'show' | 'other') => {
    if (type === 'show') {
      // missing_count = number of offline episodes (drive-accessible but file gone)
      return db.prepare(`
        SELECT m.*,
          (SELECT COUNT(*) FROM episodes e WHERE e.show_id=m.id AND e.missing_count>0) as missing_count
        FROM media_items m WHERE m.type='show' ORDER BY m.title ASC
      `).all()
    }
    if (type === 'other') {
      return db.prepare(`SELECT * FROM media_items WHERE type='movie' AND is_loose=1 ORDER BY title ASC`).all()
    }
    return db.prepare(`SELECT * FROM media_items WHERE type=? AND (is_loose=0 OR is_loose IS NULL) ORDER BY title ASC`).all(type)
  })

  ipcMain.handle('get-offline-entries', () => {
    type EpRow = { id: number; path: string; title: string | null; show_title: string }
    type MovieRow = { id: number; path: string; title: string }
    const eps = db.prepare(`
      SELECT e.id, e.path, e.title, m.title as show_title
      FROM episodes e JOIN media_items m ON m.id=e.show_id
      WHERE e.missing_count>0 ORDER BY m.title, e.season, e.episode_number
    `).all() as EpRow[]
    const movies = db.prepare(`
      SELECT id, path, title FROM media_items WHERE type='movie' AND missing_count>0 ORDER BY title
    `).all() as MovieRow[]
    return [
      ...eps.map((e) => ({ id: e.id, type: 'episode' as const, title: e.title ?? '', path: e.path, missingCount: 1, showTitle: e.show_title })),
      ...movies.map((m) => ({ id: m.id, type: 'movie' as const, title: m.title, path: m.path, missingCount: 1 })),
    ]
  })
  ipcMain.handle('get-episodes', (_e, showId: number) => {
    return db
      .prepare('SELECT * FROM episodes WHERE show_id=? ORDER BY season ASC, COALESCE(episode_number, 9999) ASC, title ASC')
      .all(showId)
  })
  ipcMain.handle('get-next-episodes', () => {
    // Window function approach: rank each episode per show by (unwatched first, then season/ep order).
    // rn=1 is the next episode to play — first unwatched, or first overall for finished shows.
    const rows = db.prepare(`
      WITH ranked AS (
        SELECT
          *,
          COUNT(*)  OVER (PARTITION BY show_id) AS total_count,
          SUM(watched) OVER (PARTITION BY show_id) AS watched_count,
          ROW_NUMBER() OVER (
            PARTITION BY show_id
            ORDER BY
              watched ASC,
              season ASC,
              COALESCE(episode_number, 9999) ASC,
              title ASC
          ) AS rn
        FROM episodes
      )
      SELECT * FROM ranked WHERE rn = 1
    `).all() as Array<{ show_id: number }>
    const result: Record<number, unknown> = {}
    for (const row of rows) result[row.show_id] = row
    return result
  })

  ipcMain.handle('save-bookmark', (_e, mediaPath: string, seconds: number) => {
    db.prepare(`
      INSERT INTO bookmarks (media_path, timestamp_seconds, updated_at)
      VALUES (?,?,?)
      ON CONFLICT(media_path) DO UPDATE SET
        timestamp_seconds=excluded.timestamp_seconds,
        updated_at=excluded.updated_at
    `).run(mediaPath, seconds, new Date().toISOString())
  })
  ipcMain.handle('get-bookmark', (_e, mediaPath: string) => {
    return db.prepare('SELECT * FROM bookmarks WHERE media_path=?').get(mediaPath) ?? null
  })
  ipcMain.handle('delete-bookmark', (_e, mediaPath: string) => {
    db.prepare('DELETE FROM bookmarks WHERE media_path=?').run(mediaPath)
  })

  ipcMain.handle('mark-watched', (_e, mediaPath: string, watched: boolean) => {
    db.prepare('UPDATE episodes SET watched=? WHERE path=?').run(watched ? 1 : 0, mediaPath)
  })

  ipcMain.handle('update-last-watched', (_e, mediaPath: string) => {
    const now = new Date().toISOString()
    const movie = db.prepare<[string], { id: number }>("SELECT id FROM media_items WHERE path=? AND type='movie'").get(mediaPath)
    if (movie) {
      db.prepare('UPDATE media_items SET last_watched_at=? WHERE id=?').run(now, movie.id)
      return { mediaId: movie.id, type: 'movie', last_watched_at: now }
    }
    const ep = db.prepare<[string], { show_id: number }>('SELECT show_id FROM episodes WHERE path=?').get(mediaPath)
    if (ep) {
      db.prepare('UPDATE media_items SET last_watched_at=? WHERE id=?').run(now, ep.show_id)
      return { mediaId: ep.show_id, type: 'show', last_watched_at: now }
    }
    return null
  })

  ipcMain.handle('get-all-bookmarks', () =>
    db.prepare('SELECT media_path, timestamp_seconds FROM bookmarks').all()
  )

  ipcMain.handle('get-tags', () =>
    db.prepare('SELECT * FROM tags ORDER BY is_default DESC, name ASC').all()
  )
  ipcMain.handle('add-tag', (_e, name: string) => {
    try {
      const r = db.prepare('INSERT INTO tags (name, is_default) VALUES (?, 0)').run(name.trim())
      return { id: Number(r.lastInsertRowid), name: name.trim(), is_default: 0 }
    } catch { return null }
  })
  ipcMain.handle('delete-tag', (_e, id: number) => {
    db.prepare('DELETE FROM tags WHERE id=? AND is_default=0').run(id)
  })
  ipcMain.handle('get-all-media-tags', () => {
    const rows = db.prepare('SELECT media_id, tag_id FROM media_tags').all() as { media_id: number; tag_id: number }[]
    const result: Record<number, number[]> = {}
    for (const r of rows) {
      if (!result[r.media_id]) result[r.media_id] = []
      result[r.media_id].push(r.tag_id)
    }
    return result
  })
  ipcMain.handle('set-media-tags', (_e, mediaId: number, tagIds: number[]) => {
    db.transaction(() => {
      db.prepare('DELETE FROM media_tags WHERE media_id=?').run(mediaId)
      const ins = db.prepare('INSERT OR IGNORE INTO media_tags (media_id, tag_id) VALUES (?, ?)')
      for (const tagId of tagIds) ins.run(mediaId, tagId)
    })()
  })

  ipcMain.handle('search-tmdb', async (_e, title: string, type: 'movie' | 'show') => {
    return searchTmdb(title, type)
  })
  ipcMain.handle('set-tmdb', async (_e, mediaId: number, tmdbId: number, type: 'movie' | 'show') => {
    return applyTmdbEntry(mediaId, tmdbId, type)
  })

  ipcMain.handle('set-title-override', (_e, mediaId: number, override: string | null) => {
    db.prepare('UPDATE media_items SET title_override=? WHERE id=?').run(override ?? null, mediaId)
  })
  ipcMain.handle('set-series-subtitle', (_e, mediaId: number, value: number | null) => {
    db.prepare('UPDATE media_items SET auto_subtitle=? WHERE id=?').run(value, mediaId)
  })

  ipcMain.handle('file-exists', (_e, filePath: string) => existsSync(filePath))
  ipcMain.handle('set-favorite', (_e, mediaId: number, fav: boolean) => {
    db.prepare('UPDATE media_items SET favorite=? WHERE id=?').run(fav ? 1 : 0, mediaId)
  })

  ipcMain.handle('get-streams', async (_e, videoPath: string) => {
    try { return await getCachedStreams(videoPath) } catch { return [] }
  })

  ipcMain.handle('needs-transcode', async (_e, videoPath: string, audioIdx: number) => {
    // Must mirror the protocol handler's logic — if we always transcode this ext,
    // the player must know so it uses seekOffset (re-spawn) instead of currentTime (range request)
    if (ALWAYS_TRANSCODE_EXTS.has(extname(videoPath).toLowerCase())) return true
    try {
      const streams = await getCachedStreams(videoPath)
      return needsTranscode(streams, audioIdx)
    } catch { return false }
  })

  ipcMain.handle('get-duration', async (_e, videoPath: string) => {
    try { return await getCachedDuration(videoPath) } catch { return 0 }
  })

  ipcMain.handle('get-subtitles', async (_e, videoPath: string): Promise<SubtitleFile[]> => {
    const external = findExternalSubtitles(videoPath)
    try {
      const streams = await getCachedStreams(videoPath)
      const subStreams = streams.filter((s) => s.codecType === 'subtitle')
      for (const s of subStreams) {
        const label = s.lang ? `Embedded (${s.lang})` : `Embedded track ${s.index}`
        external.push({ path: '', label, streamIndex: s.index })
      }
    } catch { /* ffmpeg unavailable */ }
    return external
  })

  ipcMain.handle('extract-subtitle', async (_e, videoPath: string, streamIndex: number): Promise<string | null> => {
    try { return await extractSubtitle(videoPath, streamIndex) } catch { return null }
  })

  ipcMain.handle('import-subtitle', async (): Promise<SubtitleFile | null> => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Import Subtitle',
      filters: [{ name: 'Subtitles', extensions: ['srt', 'vtt'] }],
      properties: ['openFile'],
    })
    if (canceled || !filePaths[0]) return null
    try {
      const filePath = filePaths[0]
      const raw = readFileSync(filePath, 'utf-8')
      const ext = extname(filePath).toLowerCase()
      const vttContent = ext === '.srt' ? srtToVtt(raw) : raw
      const label = basename(filePath, ext)
      return { path: filePath, label, vttContent }
    } catch { return null }
  })

  ipcMain.handle('get-app-version', () => app.getVersion())
  ipcMain.handle('check-for-updates', async () => {
    if (!app.isPackaged) return { status: 'dev' }
    try {
      await autoUpdater.checkForUpdates()
      return { status: 'checking' }
    } catch (err) {
      console.error('[updater] checkForUpdates failed:', err)
      return { status: 'error', message: String(err) }
    }
  })
  ipcMain.on('install-update', () => autoUpdater.quitAndInstall())

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('update-available', (info) => {
    BrowserWindow.getAllWindows()[0]?.webContents.send('update-available', info)
  })
  autoUpdater.on('update-not-available', () => {
    BrowserWindow.getAllWindows()[0]?.webContents.send('update-not-available')
  })
  autoUpdater.on('update-downloaded', () => {
    BrowserWindow.getAllWindows()[0]?.webContents.send('update-downloaded')
  })
  autoUpdater.on('error', (err) => {
    console.error('[updater] Error:', err.message)
    BrowserWindow.getAllWindows()[0]?.webContents.send('update-error', err.message)
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
