import axios from 'axios'
import db from './db'

const BASE = 'https://api.themoviedb.org/3'
const IMG_BASE = 'https://image.tmdb.org/t/p/w500'

// Maps TMDB genre IDs to the tag names seeded in db.ts
const TMDB_GENRE_TAGS: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Musical', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
  53: 'Thriller', 10752: 'War', 37: 'Western',
  // TV-specific composite genres mapped to closest tag
  10759: 'Action', 10765: 'Sci-Fi', 10768: 'War', 10762: 'Family'
}

function assignGenreTags(mediaId: number, genreIds: number[]): void {
  const names = [...new Set(genreIds.map((id) => TMDB_GENRE_TAGS[id]).filter(Boolean))]
  const insertTag = db.prepare('INSERT OR IGNORE INTO media_tags (media_id, tag_id) VALUES (?, ?)')
  for (const name of names) {
    const tag = db.prepare<[string], { id: number }>('SELECT id FROM tags WHERE name=? COLLATE NOCASE').get(name)
    if (tag) insertTag.run(mediaId, tag.id)
  }
}

function getApiKey(): string | null {
  const row = db.prepare<[string], { value: string }>('SELECT value FROM settings WHERE key=?').get('tmdb_api_key')
  if (!row?.value) return null
  try { return JSON.parse(row.value) as string || null } catch { return row.value || null }
}

async function fetchPosterBase64(posterPath: string): Promise<string | null> {
  try {
    const resp = await axios.get(`${IMG_BASE}${posterPath}`, { responseType: 'arraybuffer', timeout: 10000 })
    const b64 = Buffer.from(resp.data).toString('base64')
    const mime = resp.headers['content-type'] || 'image/jpeg'
    return `data:${mime};base64,${b64}`
  } catch {
    return null
  }
}

// Apply a specific TMDB entry by ID to a media item in the DB.
// Returns the new poster_base64, or null on failure.
async function applyTmdbEntryById(
  mediaId: number,
  tmdbId: number,
  type: 'movie' | 'show',
  apiKey: string
): Promise<string | null> {
  const endpoint = type === 'movie' ? `movie/${tmdbId}` : `tv/${tmdbId}`
  const resp = await axios.get(`${BASE}/${endpoint}`, { params: { api_key: apiKey }, timeout: 8000 })
  const data = resp.data
  const posterPath: string = data.poster_path || ''
  const overview: string = data.overview || ''
  const rating: number = data.vote_average || 0
  const rawYear = type === 'movie' ? data.release_date?.slice(0, 4) : data.first_air_date?.slice(0, 4)
  const year = rawYear ? parseInt(rawYear, 10) : null
  const poster = posterPath ? await fetchPosterBase64(posterPath) : null

  db.prepare(`
    UPDATE media_items
    SET tmdb_id=?, overview=?, rating=?, year=?, poster_base64=COALESCE(?,poster_base64)
    WHERE id=?
  `).run(tmdbId, overview, rating, year, poster, mediaId)

  const genreIds: number[] = (data.genres ?? []).map((g: { id: number }) => g.id)
  if (genreIds.length) assignGenreTags(mediaId, genreIds)

  return poster
}

async function enrichItem(item: {
  id: number
  title: string
  type: 'movie' | 'show'
  year?: number
}, apiKey: string): Promise<void> {
  try {
    const endpoint = item.type === 'movie' ? 'movie' : 'tv'
    const resp = await axios.get(`${BASE}/search/${endpoint}`, {
      params: { api_key: apiKey, query: item.title, year: item.year },
      timeout: 8000
    })
    const results = resp.data.results
    if (!results?.length) return

    const match = results[0]
    const tmdbId: number = match.id
    const overview: string = match.overview || ''
    const rating: number = match.vote_average || 0
    const posterPath: string = match.poster_path || ''
    const rawYear = item.type === 'movie'
      ? match.release_date?.slice(0, 4)
      : match.first_air_date?.slice(0, 4)
    const year = rawYear ? parseInt(rawYear, 10) : null

    const poster = posterPath ? await fetchPosterBase64(posterPath) : null

    db.prepare(`
      UPDATE media_items
      SET tmdb_id=?, overview=?, rating=?, year=?, poster_base64=COALESCE(?,poster_base64)
      WHERE id=?
    `).run(tmdbId, overview, rating, year, poster, item.id)

    const genreIds: number[] = match.genre_ids ?? []
    if (genreIds.length) assignGenreTags(item.id, genreIds)
  } catch {
    // Silently ignore network errors
  }
}

async function backfillGenres(
  mediaId: number,
  type: 'movie' | 'show',
  tmdbId: number,
  apiKey: string
): Promise<void> {
  try {
    const endpoint = type === 'movie' ? `movie/${tmdbId}` : `tv/${tmdbId}`
    const resp = await axios.get(`${BASE}/${endpoint}`, {
      params: { api_key: apiKey },
      timeout: 8000
    })
    const genres: { id: number }[] = resp.data.genres ?? []
    if (genres.length) assignGenreTags(mediaId, genres.map((g) => g.id))
  } catch { /* ignore network errors */ }
}

export async function fetchTmdbMetadata(): Promise<void> {
  const apiKey = getApiKey()
  if (!apiKey) return

  // Items without poster/TMDB data that haven't been pinned by the user
  const needsFetch = db
    .prepare<[], { id: number; title: string; title_override: string | null; type: 'movie' | 'show'; year: number | null }>(
      `SELECT id, title, title_override, type, year FROM media_items
       WHERE (poster_base64 IS NULL OR tmdb_id IS NULL) AND pinned_tmdb_id IS NULL`
    )
    .all()

  for (const item of needsFetch) {
    await enrichItem({ id: item.id, title: item.title_override ?? item.title, type: item.type, year: item.year ?? undefined }, apiKey)
    await new Promise((r) => setTimeout(r, 250))
  }

  // Re-apply pinned entries that have drifted (wrong tmdb_id) or lost their poster
  const pinnedDrifted = db
    .prepare<[], { id: number; type: 'movie' | 'show'; pinned_tmdb_id: number }>(
      `SELECT id, type, pinned_tmdb_id FROM media_items
       WHERE pinned_tmdb_id IS NOT NULL
         AND (poster_base64 IS NULL OR tmdb_id IS NULL OR tmdb_id != pinned_tmdb_id)`
    )
    .all()

  for (const item of pinnedDrifted) {
    try {
      await applyTmdbEntryById(item.id, item.pinned_tmdb_id, item.type, apiKey)
    } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 250))
  }

  // Items that have TMDB data but were never assigned genre tags
  const needsTags = db
    .prepare<[], { id: number; type: 'movie' | 'show'; tmdb_id: number }>(
      `SELECT id, type, tmdb_id FROM media_items
       WHERE tmdb_id IS NOT NULL
         AND id NOT IN (SELECT DISTINCT media_id FROM media_tags)`
    )
    .all()

  for (const item of needsTags) {
    await backfillGenres(item.id, item.type, item.tmdb_id, apiKey)
    await new Promise((r) => setTimeout(r, 250))
  }
}

// Search TMDB for a title; returns top results for the poster picker UI.
export async function searchTmdb(
  title: string,
  type: 'movie' | 'show'
): Promise<Array<{ tmdbId: number; title: string; year?: number; posterPath?: string; overview?: string }>> {
  const apiKey = getApiKey()
  if (!apiKey) return []
  try {
    const endpoint = type === 'movie' ? 'movie' : 'tv'
    const resp = await axios.get(`${BASE}/search/${endpoint}`, {
      params: { api_key: apiKey, query: title },
      timeout: 8000
    })
    const results: Record<string, unknown>[] = resp.data.results ?? []
    return results.slice(0, 9).map((r) => ({
      tmdbId: r.id as number,
      title: (type === 'movie' ? r.title : r.name) as string,
      year: parseInt(((type === 'movie' ? r.release_date : r.first_air_date) as string)?.slice(0, 4) ?? '') || undefined,
      posterPath: (r.poster_path as string) || undefined,
      overview: (r.overview as string) || undefined,
    }))
  } catch {
    return []
  }
}

// Apply a specific TMDB entry chosen by the user. Saves pinned_tmdb_id so scans won't overwrite it.
export async function applyTmdbEntry(
  mediaId: number,
  tmdbId: number,
  type: 'movie' | 'show'
): Promise<string | null> {
  const apiKey = getApiKey()
  if (!apiKey) return null
  try {
    await applyTmdbEntryById(mediaId, tmdbId, type, apiKey)
  } catch { /* best-effort poster download */ }
  // Persist the pin regardless of whether the poster download succeeded
  db.prepare('UPDATE media_items SET pinned_tmdb_id=? WHERE id=?').run(tmdbId, mediaId)
  // Return whatever poster is currently in the DB (new if download succeeded, existing otherwise)
  const row = db.prepare<[number], { poster_base64: string | null }>('SELECT poster_base64 FROM media_items WHERE id=?').get(mediaId)
  return row?.poster_base64 ?? null
}
