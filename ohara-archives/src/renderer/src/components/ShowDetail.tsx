import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useStore } from '../store'
import type { MediaItem, Episode } from '../../../preload/index.d'
import PlaceholderPoster from './PlaceholderPoster'
import TagPicker, { tagColor } from './TagPicker'

interface Props {
  show: MediaItem
  onClose: () => void
  initialSeason?: number
}

export default function ShowDetail({ show, onClose, initialSeason }: Props) {
  const { episodes, loadEpisodes, tags, mediaTags, updateLastWatched } = useStore()
  const [bookmarks, setBookmarks] = useState<Record<string, number>>({})
  const [continueEp, setContinueEp] = useState<Episode | null>(null)
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null)
  const [editingTags, setEditingTags] = useState(false)
  const [localDurations, setLocalDurations] = useState<Record<string, number>>({})
  const probedRef = useRef<Set<string>>(new Set())
  const navigate = useNavigate()

  const showTagIds = mediaTags[show.id] ?? []
  const showTags = showTagIds.map((id) => tags.find((t) => t.id === id)).filter(Boolean) as typeof tags

  const eps: Episode[] = episodes[show.id] ?? []

  useEffect(() => {
    loadEpisodes(show.id)
  }, [show.id])

  useEffect(() => {
    if (!eps.length) return
    const fetchBookmarks = async () => {
      const bm: Record<string, number> = {}
      let latestEp: Episode | null = null
      for (const ep of eps) {
        const b = await window.api.getBookmark(ep.path)
        if (b) {
          bm[ep.path] = b.timestamp_seconds
          latestEp = ep
        }
      }
      setBookmarks(bm)
      setContinueEp(latestEp)
    }
    fetchBookmarks()
  }, [eps])

  const seasons = useMemo(() => {
    const map: Record<number, Episode[]> = {}
    for (const ep of eps) {
      if (!map[ep.season]) map[ep.season] = []
      map[ep.season].push(ep)
    }
    return Object.entries(map)
      .map(([s, list]) => ({ season: parseInt(s, 10), episodes: list }))
      .sort((a, b) => a.season - b.season)
  }, [eps])

  // Auto-select season: prefer initialSeason, then auto-select if only one
  useEffect(() => {
    if (!seasons.length) return
    if (initialSeason != null && seasons.some((s) => s.season === initialSeason)) {
      setSelectedSeason(initialSeason)
    } else if (seasons.length === 1) {
      setSelectedSeason(seasons[0].season)
    }
  }, [seasons.length, initialSeason])

  const currentSeasonEps = useMemo(
    () => seasons.find((s) => s.season === selectedSeason)?.episodes ?? [],
    [seasons, selectedSeason]
  )

  // Probe durations for episodes in the current season that don't have one yet
  useEffect(() => {
    const needsProbe = currentSeasonEps.filter((ep) => !ep.duration_seconds && !probedRef.current.has(ep.path))
    if (!needsProbe.length) return
    needsProbe.forEach((ep) => probedRef.current.add(ep.path))
    Promise.all(needsProbe.map((ep) => window.api.getDuration(ep.path).then((dur) => ({ path: ep.path, dur }))))
      .then((results) => {
        const updates: Record<string, number> = {}
        for (const r of results) { if (r.dur > 0) updates[r.path] = r.dur }
        if (Object.keys(updates).length) setLocalDurations((prev) => ({ ...prev, ...updates }))
      })
  }, [currentSeasonEps])

  const watchedCount = eps.filter((e) => e.watched).length

  const removeEpBookmark = async (e: React.MouseEvent, ep: Episode) => {
    e.stopPropagation()
    await window.api.deleteBookmark(ep.path)
    setBookmarks((prev) => { const next = { ...prev }; delete next[ep.path]; return next })
    if (continueEp?.id === ep.id) setContinueEp(null)
  }

  const playEpisode = (ep: Episode) => {
    updateLastWatched(ep.path)
    navigate('/player', {
      state: {
        path: ep.path,
        isEpisode: true,
        durationSeconds: ep.duration_seconds || localDurations[ep.path],
        showId: show.id,
        seasonNumber: ep.season,
        title: `${show.title} — ${ep.season > 0 ? `S${String(ep.season).padStart(2, '0')}` : ''}${ep.episode_number != null ? `E${String(ep.episode_number).padStart(2, '0')}` : ''} ${ep.title ?? ''}`.trim()
      }
    })
  }

  const formatDur = (sec: number | undefined): string => {
    if (!sec || sec <= 0) return ''
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = Math.floor(sec % 60)
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const playRandom = (pool: Episode[]) => {
    if (!pool.length) return
    playEpisode(pool[Math.floor(Math.random() * pool.length)])
  }

  const toggleWatched = async (e: React.MouseEvent, ep: Episode) => {
    e.stopPropagation()
    await window.api.markWatched(ep.path, !ep.watched)
    loadEpisodes(show.id)
  }

  const markSeason = async (pool: Episode[], watched: boolean) => {
    for (const ep of pool) {
      if (ep.watched !== watched) await window.api.markWatched(ep.path, watched)
    }
    loadEpisodes(show.id)
  }

  const showSeasonPicker = selectedSeason === null && seasons.length > 1

  return (
    <motion.div
      className="show-detail-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <motion.div
        className="show-detail-panel"
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="show-detail-header">
          <div className="show-detail-poster">
            {show.poster_base64 ? (
              <img src={show.poster_base64} alt={show.title} />
            ) : (
              <PlaceholderPoster title={show.title} />
            )}
          </div>

          <div className="show-detail-info">
            <div className="show-detail-title">{show.title}</div>
            <div className="show-detail-meta">
              {show.year && <span>{show.year} · </span>}
              {show.rating != null && show.rating > 0 && (
                <span className="rating-badge">★ {show.rating.toFixed(1)} · </span>
              )}
              <span>
                {seasons.length} Season{seasons.length !== 1 ? 's' : ''} · {eps.length} Episode{eps.length !== 1 ? 's' : ''}
              </span>
              {eps.length > 0 && (
                <span className="watched-progress"> · {watchedCount}/{eps.length} watched</span>
              )}
            </div>
            {show.overview && (
              <div className="show-detail-overview">{show.overview}</div>
            )}

            <div className="show-detail-tags-row">
              {showTags.map((tag) => (
                <span key={tag.id} className="detail-tag-chip" style={{ borderColor: tagColor(tag.id), color: tagColor(tag.id), background: `${tagColor(tag.id)}1a` }}>
                  {tag.name}
                </span>
              ))}
              <button
                className="tag-edit-inline-btn"
                onClick={() => setEditingTags((v) => !v)}
                title="Edit tags"
              >
                {editingTags ? '✕ Done' : showTags.length === 0 ? '+ Tags' : '✎'}
              </button>
            </div>

            {editingTags && (
              <TagPicker mediaId={show.id} />
            )}
          </div>

          <button className="show-detail-close" onClick={onClose}>×</button>
        </div>

        {/* ── Season Picker ───────────────────────────────────────────────── */}
        {showSeasonPicker && (
          <div className="season-picker">
            <div className="season-picker-toolbar">
              {continueEp && (
                <button className="continue-btn" style={{ marginTop: 0 }} onClick={() => playEpisode(continueEp)}>
                  ▶ Continue{' '}
                  {continueEp.episode_number != null
                    ? `S${String(continueEp.season).padStart(2, '0')}E${String(continueEp.episode_number).padStart(2, '0')}`
                    : continueEp.title}
                </button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => playRandom(eps)}>
                🎲 Random Episode
              </button>
            </div>

            <div className="season-grid">
              {seasons.map(({ season, episodes: seasonEps }) => {
                const sw = seasonEps.filter((e) => e.watched).length
                return (
                  <div key={season} className="season-card" onClick={() => setSelectedSeason(season)}>
                    <div className="season-card-label">Season {season}</div>
                    <div className="season-card-stats">
                      {seasonEps.length} ep{seasonEps.length !== 1 ? 's' : ''}
                      <span className="season-card-watched">{sw}/{seasonEps.length} watched</span>
                    </div>
                    <button
                      className="season-card-random"
                      title="Random episode from this season"
                      onClick={(e) => { e.stopPropagation(); playRandom(seasonEps) }}
                    >
                      🎲 Random
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Episode List ────────────────────────────────────────────────── */}
        {!showSeasonPicker && selectedSeason !== null && (
          <div className="episode-view">
            <div className="episode-view-toolbar">
              {seasons.length > 1 && (
                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedSeason(null)}>
                  ← Seasons
                </button>
              )}

              {seasons.length > 1 && (
                <select
                  className="season-select"
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(parseInt(e.target.value, 10))}
                >
                  {seasons.map(({ season }) => (
                    <option key={season} value={season}>Season {season}</option>
                  ))}
                </select>
              )}

              {continueEp && (
                <button className="continue-btn" style={{ fontSize: 12, padding: '5px 12px', marginTop: 0 }} onClick={() => playEpisode(continueEp)}>
                  ▶ Continue
                </button>
              )}

              <button className="btn btn-ghost btn-sm" onClick={() => playRandom(currentSeasonEps)}>
                🎲 Random
              </button>

              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                {currentSeasonEps.some((e) => !e.watched) && (
                  <button className="btn btn-ghost btn-sm" onClick={() => markSeason(currentSeasonEps, true)}>
                    ✓ Mark all
                  </button>
                )}
                {currentSeasonEps.some((e) => e.watched) && (
                  <button className="btn btn-ghost btn-sm" onClick={() => markSeason(currentSeasonEps, false)}>
                    ○ Clear
                  </button>
                )}
              </div>
            </div>

            <div className="episode-list">
              {currentSeasonEps.map((ep) => (
                <div
                  key={ep.id}
                  className={`episode-row ${ep.watched ? 'episode-watched' : ''}`}
                  onClick={() => playEpisode(ep)}
                >
                  <button
                    className={`ep-watch-toggle ${ep.watched ? 'watched' : ''}`}
                    onClick={(e) => toggleWatched(e, ep)}
                    title={ep.watched ? 'Mark unwatched' : 'Mark watched'}
                  >
                    {ep.watched ? '✓' : '○'}
                  </button>
                  <span className="ep-num">
                    {ep.episode_number != null ? `E${String(ep.episode_number).padStart(2, '0')}` : '—'}
                  </span>
                  <span className="ep-title">{ep.title ?? ep.path.split('/').pop()}</span>
                  {(() => { const d = ep.duration_seconds || localDurations[ep.path]; return d && d > 0 ? <span className="ep-duration">{formatDur(d)}</span> : null })()}
                  {bookmarks[ep.path] && (
                    <span className="ep-bookmark" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      🔖
                      <button
                        className="ep-bookmark-remove"
                        onClick={(e) => removeEpBookmark(e, ep)}
                        title="Remove bookmark"
                      >
                        ×
                      </button>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
