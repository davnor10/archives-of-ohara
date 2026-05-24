import { readdirSync, statSync, existsSync } from 'fs'
import { join, extname } from 'path'

function pruneOrphans(): void {
  const allEps = db.prepare('SELECT id, path FROM episodes').all() as { id: number; path: string }[]
  const deleteEp = db.prepare('DELETE FROM episodes WHERE id=?')
  const pruneEps = db.transaction(() => {
    for (const ep of allEps) {
      if (!existsSync(ep.path)) deleteEp.run(ep.id)
    }
  })
  pruneEps()

  // Remove shows with no episodes remaining
  db.prepare(
    `DELETE FROM media_items WHERE type='show' AND id NOT IN (SELECT DISTINCT show_id FROM episodes)`
  ).run()

  const allMovies = db
    .prepare("SELECT id, path FROM media_items WHERE type='movie'")
    .all() as { id: number; path: string }[]
  const deleteItem = db.prepare('DELETE FROM media_items WHERE id=?')
  const pruneMovies = db.transaction(() => {
    for (const m of allMovies) {
      if (!existsSync(m.path)) deleteItem.run(m.id)
    }
  })
  pruneMovies()
}
import db from './db'

const VIDEO_EXTS = new Set(['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.m4v'])

function cleanTitle(raw: string): string {
  return raw
    .replace(/\.(mp4|mkv|avi|mov|wmv|m4v)$/i, '')
    .replace(/[._]/g, ' ')
    .replace(
      /\b(1080p|720p|480p|2160p|4k|bluray|blu-ray|webrip|web-dl|hdtv|x264|x265|hevc|aac|ac3|dts|h264|h265|xvid|divx)\b/gi,
      ''
    )
    .replace(/\(\d{4}\)/g, '')
    .replace(/\[\d{4}\]/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function isVideo(name: string): boolean {
  return VIDEO_EXTS.has(extname(name).toLowerCase())
}

function safeReadDir(p: string): string[] {
  try {
    return readdirSync(p)
  } catch {
    return []
  }
}

function safeStat(p: string) {
  try {
    return statSync(p)
  } catch {
    return null
  }
}

function getOrCreateShow(title: string, showPath: string, now: string): number {
  const existing = db
    .prepare<[string], { id: number }>('SELECT id FROM media_items WHERE path=?')
    .get(showPath)
  if (existing) return existing.id

  const result = db
    .prepare(
      `INSERT OR IGNORE INTO media_items (type,title,path,scanned_at) VALUES ('show',?,?,?)`
    )
    .run(title, showPath, now)

  if (result.changes > 0) return Number(result.lastInsertRowid)

  return db
    .prepare<[string], { id: number }>('SELECT id FROM media_items WHERE path=?')
    .get(showPath)!.id
}

const upsertEp = db.prepare(`
  INSERT INTO episodes (show_id,season,episode_number,title,path,scanned_at)
  VALUES (?,?,?,?,?,?)
  ON CONFLICT(path) DO UPDATE SET
    show_id=excluded.show_id,
    season=excluded.season,
    episode_number=excluded.episode_number,
    title=excluded.title,
    scanned_at=excluded.scanned_at
`)

const upsertMovie = db.prepare(`
  INSERT INTO media_items (type,title,path,scanned_at)
  VALUES ('movie',?,?,?)
  ON CONFLICT(path) DO UPDATE SET title=excluded.title, scanned_at=excluded.scanned_at
`)

function parseEpInfo(filename: string): { season: number; ep: number | null } {
  const sxe = filename.match(/[sS](\d+)[eE](\d+)/)
  if (sxe) return { season: parseInt(sxe[1], 10), ep: parseInt(sxe[2], 10) }
  const nxn = filename.match(/(\d+)[xX](\d+)/)
  if (nxn) return { season: parseInt(nxn[1], 10), ep: parseInt(nxn[2], 10) }
  const ep = filename.match(/[eE]p?(\d+)/i)
  if (ep) return { season: 1, ep: parseInt(ep[1], 10) }
  return { season: 1, ep: null }
}

function scanShows(rootPaths: string[], now: string): void {
  for (const root of rootPaths) {
    if (!existsSync(root)) continue
    for (const showName of safeReadDir(root)) {
      const showPath = join(root, showName)
      const stat = safeStat(showPath)
      if (!stat?.isDirectory()) continue

      const title = cleanTitle(showName)
      let showId: number | null = null

      const ensureShow = () => {
        if (showId === null) showId = getOrCreateShow(title, showPath, now)
        return showId
      }

      for (const sub of safeReadDir(showPath)) {
        const subPath = join(showPath, sub)
        const subStat = safeStat(subPath)
        if (!subStat) continue

        if (subStat.isDirectory()) {
          const seasonMatch = sub.match(/season\s*(\d+)/i) || sub.match(/^[sS](\d+)$/) || sub.match(/^(\d+)$/)
          const season = seasonMatch ? parseInt(seasonMatch[1], 10) : 1
          for (const epFile of safeReadDir(subPath)) {
            if (!isVideo(epFile)) continue
            const { ep } = parseEpInfo(epFile)
            upsertEp.run(ensureShow(), season, ep, cleanTitle(epFile), join(subPath, epFile), now)
          }
        } else if (subStat.isFile() && isVideo(sub)) {
          const { season, ep } = parseEpInfo(sub)
          upsertEp.run(ensureShow(), season, ep, cleanTitle(sub), subPath, now)
        }
      }
    }
  }
}

function scanMovies(rootPaths: string[], now: string): void {
  for (const root of rootPaths) {
    if (!existsSync(root)) continue
    for (const entry of safeReadDir(root)) {
      const fullPath = join(root, entry)
      const stat = safeStat(fullPath)
      if (!stat) continue

      if (stat.isFile() && isVideo(entry)) {
        upsertMovie.run(cleanTitle(entry), fullPath, now)
      } else if (stat.isDirectory()) {
        for (const sub of safeReadDir(fullPath)) {
          if (isVideo(sub)) {
            upsertMovie.run(cleanTitle(entry), join(fullPath, sub), now)
            break
          }
        }
      }
    }
  }
}

export function scanMedia(): { shows: number; movies: number } {
  const getSetting = db.prepare<[string], { value: string }>('SELECT value FROM settings WHERE key=?')
  const showPaths: string[] = JSON.parse(getSetting.get('show_paths')?.value ?? '[]')
  const moviePaths: string[] = JSON.parse(getSetting.get('movie_paths')?.value ?? '[]')

  const now = new Date().toISOString()
  scanShows(showPaths, now)
  scanMovies(moviePaths, now)

  pruneOrphans()

  const shows = (db.prepare("SELECT COUNT(*) as n FROM media_items WHERE type='show'").get() as { n: number }).n
  const movies = (db.prepare("SELECT COUNT(*) as n FROM media_items WHERE type='movie'").get() as { n: number }).n
  return { shows, movies }
}
