import { useState, useEffect, useRef } from 'react'
import type { MediaItem, TmdbResult } from '../../../preload/index.d'
import { useStore } from '../store'

const TMDB_IMG = 'https://image.tmdb.org/t/p/w200'

interface Props {
  item: MediaItem
  onClose: () => void
}

export default function PosterPickerModal({ item, onClose }: Props) {
  const { updateItemPoster, settings } = useStore()
  const [query, setQuery] = useState(item.title)
  const [results, setResults] = useState<TmdbResult[]>([])
  const [loading, setLoading] = useState(false)
  const [applyingId, setApplyingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const search = async (q: string) => {
    if (!q.trim()) return
    if (!settings.tmdb_api_key) {
      setError('No TMDB API key configured — add one in Settings.')
      return
    }
    // Guard against stale preload (app needs restart after updates)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (window.api as any).searchTmdb !== 'function') {
      setError('Search unavailable — please restart the app.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await window.api.searchTmdb(q.trim(), item.type)
      setResults(res)
      if (!res.length) setError('No results found.')
    } catch (e) {
      console.error('[PosterPicker] search error:', e)
      setError(`Search failed: ${e instanceof Error ? e.message : 'unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    search(item.title)
    setTimeout(() => inputRef.current?.focus(), 50)
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const apply = async (result: TmdbResult) => {
    setApplyingId(result.tmdbId)
    try {
      const poster = await window.api.setTmdb(item.id, result.tmdbId, item.type)
      if (poster) updateItemPoster(item.id, item.type, poster)
      onClose()
    } catch (e) {
      console.error('[PosterPicker] apply error:', e)
      setApplyingId(null)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="poster-picker-modal">
        <div className="poster-picker-header">
          <div>
            <div className="poster-picker-title">Choose Poster</div>
            <div className="poster-picker-subtitle">{item.title}</div>
          </div>
          <button className="poster-picker-close" onClick={onClose}>✕</button>
        </div>

        <div className="poster-picker-search">
          <input
            ref={inputRef}
            className="settings-input"
            style={{ flex: 1 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search(query)}
            placeholder="Search TMDB…"
          />
          <button
            className="btn btn-ghost"
            onClick={() => search(query)}
            disabled={loading}
            style={{ flexShrink: 0 }}
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>

        {error && (
          <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
            {error}
          </div>
        )}

        {results.length > 0 && (
          <div className="poster-picker-grid">
            {results.map((r) => (
              <button
                key={r.tmdbId}
                className="poster-picker-card"
                onClick={() => apply(r)}
                disabled={applyingId !== null}
                title={`${r.title}${r.year ? ` (${r.year})` : ''}`}
              >
                {r.posterPath ? (
                  <img
                    src={`${TMDB_IMG}${r.posterPath}`}
                    alt={r.title}
                    className="poster-picker-img"
                    loading="lazy"
                  />
                ) : (
                  <div className="poster-picker-no-img">No image</div>
                )}
                {applyingId === r.tmdbId && (
                  <div className="poster-picker-applying" />
                )}
                <div className="poster-picker-card-label">
                  <div className="poster-picker-card-title">{r.title}</div>
                  {r.year && <div className="poster-picker-card-year">{r.year}</div>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
