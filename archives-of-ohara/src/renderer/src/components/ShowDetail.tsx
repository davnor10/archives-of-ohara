import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useStore } from '../store'
import type { MediaItem, Episode } from '../../../preload/index.d'
import PlaceholderPoster from './PlaceholderPoster'
import TagPicker, { tagColor } from './TagPicker'
import PosterPickerModal from './PosterPickerModal'

interface Props {
  show: MediaItem
  onClose: () => void
  initialSeason?: number
}

export default function ShowDetail({ show, onClose, initialSeason }: Props) {
  const { episodes, loadEpisodes, reloadEpisodes, setEpisodeWatched, tags, mediaTags, updateLastWatched, setTitleOverride, setSeriesSubtitle, setFavorite, bookmarks: storeBookmarks, removeBookmark } = useStore()
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null)
  const [editingTags, setEditingTags] = useState(false)
  const [localDurations, setLocalDurations] = useState<Record<string, number>>({})
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState('')
  const [posterPickerOpen, setPosterPickerOpen] = useState(false)
  const probedRef = useRef<Set<string>>(new Set())
  const navigate = useNavigate()

  const displayTitle = show.title_override ?? show.title

  const handleEditTitle = () => {
    setTitleInput(show.title_override ?? show.title)
    setEditingTitle(true)
  }

  const handleSaveTitleOverride = async () => {
    const val = titleInput.trim()
    await setTitleOverride(show.id, 'show', val === show.title ? null : val || null)
    setEditingTitle(false)
  }

  const handleClearTitleOverride = async () => {
    await setTitleOverride(show.id, 'show', null)
    setEditingTitle(false)
  }

  const showTagIds = mediaTags[show.id] ?? []
  const showTags = showTagIds.map((id) => tags.find((t) => t.id === id)).filter(Boolean) as typeof tags

  const eps: Episode[] = episodes[show.id] ?? []

  // Derive bookmarks and continueEp from the global store instead of N serial IPC calls
  const bookmarks = useMemo(() => {
    const bm: Record<string, number> = {}
    for (const ep of eps) {
      const v = storeBookmarks[ep.path]
      if (v != null) bm[ep.path] = v
    }
    return bm
  }, [eps, storeBookmarks])

  const continueEp = useMemo(() => {
    let result: Episode | null = null
    for (const ep of eps) {
      if (bookmarks[ep.path] != null) result = ep
    }
    return result
  }, [eps, bookmarks])

  useEffect(() => {
    loadEpisodes(show.id)
  }, [show.id])

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
  const watchedPct = eps.length > 0 ? (watchedCount / eps.length) * 100 : 0

  // First unwatched episode in the current season (for episode list highlight)
  const nextUpEp = useMemo(
    () => currentSeasonEps.find((ep) => !ep.watched) ?? null,
    [currentSeasonEps]
  )

  // First unwatched episode across the whole show (for Continue button)
  const nextUnwatchedEp = useMemo(
    () => eps.find((ep) => !ep.watched) ?? null,
    [eps]
  )

  const removeEpBookmark = async (e: React.MouseEvent, ep: Episode) => {
    e.stopPropagation()
    await removeBookmark(ep.path)
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
        autoSubtitleOverride: show.auto_subtitle ?? null,
        title: `${displayTitle} - ${ep.season > 0 && seasons.length > 1 ? `S${String(ep.season).padStart(2, '0')}` : ''}${ep.episode_number != null ? `E${String(ep.episode_number).padStart(2, '0')}` : ''} ${ep.title ?? ''}`.trim()
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
    const newWatched = !ep.watched
    // Optimistic update — instant feedback, no reload needed
    setEpisodeWatched(show.id, ep.path, newWatched)
    await window.api.markWatched(ep.path, newWatched)
  }

  const markSeason = async (pool: Episode[], watched: boolean) => {
    const toUpdate = pool.filter((ep) => Boolean(ep.watched) !== watched)
    if (!toUpdate.length) return
    // Optimistic bulk update
    for (const ep of toUpdate) setEpisodeWatched(show.id, ep.path, watched)
    // Fire all IPC calls in parallel
    await Promise.all(toUpdate.map((ep) => window.api.markWatched(ep.path, watched)))
    // Reload to confirm DB state
    reloadEpisodes(show.id)
  }

  const showSeasonPicker = selectedSeason === null && seasons.length > 1

  return (
    <>
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
          <div
            className="show-detail-poster"
            onClick={() => setPosterPickerOpen(true)}
            title="Change poster"
            style={{ cursor: 'pointer', position: 'relative' }}
          >
            {show.poster_base64 ? (
              <img src={show.poster_base64} alt={show.title} />
            ) : (
              <PlaceholderPoster title={show.title} />
            )}
            <div className="poster-change-overlay">🖼</div>
          </div>

          <div className="show-detail-info">
            <div className="show-detail-title-row">
              <span className="show-detail-title">{displayTitle}</span>
              <button className="title-edit-btn" onClick={handleEditTitle} title="Override title">✎</button>
            </div>

            {editingTitle && (
              <div className="title-override-row">
                <input
                  className="settings-input title-override-input"
                  value={titleInput}
                  autoFocus
                  onChange={(e) => setTitleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitleOverride()
                    if (e.key === 'Escape') setEditingTitle(false)
                  }}
                  placeholder={show.title}
                />
                <button className="btn btn-primary btn-sm" onClick={handleSaveTitleOverride}>Save</button>
                {show.title_override && (
                  <button className="btn btn-ghost btn-sm" onClick={handleClearTitleOverride}>Clear</button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingTitle(false)}>✕</button>
              </div>
            )}

            <div className="show-detail-meta">
              {show.year && <span>{show.year} · </span>}
              {show.rating != null && show.rating > 0 && (
                <span className="rating-badge">★ {show.rating.toFixed(1)} · </span>
              )}
              <span>
                {seasons.length} Season{seasons.length !== 1 ? 's' : ''} · {eps.length} Episode{eps.length !== 1 ? 's' : ''}
              </span>
            </div>

            {eps.length > 0 && (
              <div className="show-progress-wrap">
                <div className="show-progress-track">
                  <div className="show-progress-fill" style={{ width: `${watchedPct}%` }} />
                </div>
                <span className="watched-progress">{watchedCount}/{eps.length} watched</span>
              </div>
            )}

            {show.overview && (
              <div className="show-detail-overview">{show.overview}</div>
            )}

            <div className="series-subtitle-toggle">
              <span className="series-subtitle-label">Subtitles</span>
              <button
                className={`btn btn-sm ${show.auto_subtitle == null ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setSeriesSubtitle(show.id, null)}
                title="Use global subtitle setting"
              >Global</button>
              <button
                className={`btn btn-sm ${show.auto_subtitle === 1 ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setSeriesSubtitle(show.id, 1)}
                title="Always auto-play subtitles for this series"
              >On</button>
              <button
                className={`btn btn-sm ${show.auto_subtitle === 0 ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setSeriesSubtitle(show.id, 0)}
                title="Never auto-play subtitles for this series"
              >Off</button>
              <button
                className="tag-edit-inline-btn"
                onClick={() => setFavorite(show.id, 'show', !show.favorite)}
                title={show.favorite ? 'Remove from favorites' : 'Add to favorites'}
                style={show.favorite ? { color: 'var(--gold)', borderColor: 'rgba(201,168,76,0.6)' } : undefined}
              >
                {show.favorite ? '★' : '☆'}
              </button>
            </div>

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
              {eps.length > 0 && (watchedCount === 0 || watchedCount === eps.length) && !continueEp && (
                <button className="continue-btn" style={{ marginTop: 0 }} onClick={() => playEpisode(eps[0])}>
                  ▶ Start watching
                </button>
              )}
              {continueEp && (
                <button className="continue-btn" style={{ marginTop: 0 }} onClick={() => playEpisode(continueEp)}>
                  ▶ Continue{' '}
                  {continueEp.episode_number != null
                    ? `S${String(continueEp.season).padStart(2, '0')}E${String(continueEp.episode_number).padStart(2, '0')}`
                    : continueEp.title}
                </button>
              )}
              {!continueEp && watchedCount > 0 && watchedCount < eps.length && nextUnwatchedEp && (
                <button className="btn btn-ghost btn-sm" onClick={() => playEpisode(nextUnwatchedEp)}>
                  ▶ Continue
                </button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => playRandom(eps)}>
                🎲 Random Episode
              </button>
            </div>

            <div className="season-grid">
              {seasons.map(({ season, episodes: seasonEps }) => {
                const sw = seasonEps.filter((e) => e.watched).length
                const pct = seasonEps.length > 0 ? (sw / seasonEps.length) * 100 : 0
                const allWatched = sw === seasonEps.length
                return (
                  <div key={season} className="season-card" onClick={() => setSelectedSeason(season)}>
                    <div className="season-card-label">
                      Season {season}
                      {allWatched && <span className="season-card-done">✓</span>}
                    </div>
                    <div className="season-card-progress-track">
                      <div className="season-card-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="season-card-stats">
                      {seasonEps.length} ep{seasonEps.length !== 1 ? 's' : ''}
                      <span className="season-card-watched">{sw}/{seasonEps.length}</span>
                    </div>
                    <button
                      className="season-card-random"
                      title="Random episode from this season"
                      onClick={(e) => { e.stopPropagation(); playRandom(seasonEps) }}
                    >
                      🎲
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

              {seasons.length > 1 && (() => {
                const idx = seasons.findIndex((s) => s.season === selectedSeason)
                const prev = idx > 0 ? seasons[idx - 1].season : null
                const next = idx < seasons.length - 1 ? seasons[idx + 1].season : null
                return (
                  <>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => prev !== null && setSelectedSeason(prev)}
                      disabled={prev === null}
                    >
                      ‹ Prev
                    </button>
                    <select
                      className="season-select"
                      value={selectedSeason}
                      onChange={(e) => setSelectedSeason(parseInt(e.target.value, 10))}
                    >
                      {seasons.map(({ season }) => (
                        <option key={season} value={season}>Season {season}</option>
                      ))}
                    </select>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => next !== null && setSelectedSeason(next)}
                      disabled={next === null}
                    >
                      Next ›
                    </button>
                  </>
                )
              })()}

              {eps.length > 0 && (watchedCount === 0 || watchedCount === eps.length) && !continueEp && (
                <button className="continue-btn" style={{ fontSize: 12, padding: '5px 12px', marginTop: 0 }} onClick={() => playEpisode(eps[0])}>
                  ▶ Start
                </button>
              )}
              {continueEp && (
                <button className="continue-btn" style={{ fontSize: 12, padding: '5px 12px', marginTop: 0 }} onClick={() => playEpisode(continueEp)}>
                  ▶ Continue
                </button>
              )}
              {!continueEp && watchedCount > 0 && watchedCount < eps.length && nextUnwatchedEp && (
                <button className="btn btn-ghost btn-sm" onClick={() => playEpisode(nextUnwatchedEp)}>
                  ▶ Continue
                </button>
              )}

              <button className="btn btn-ghost btn-sm" onClick={() => playRandom(currentSeasonEps)} title="Random episode">
                🎲
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
              {currentSeasonEps.map((ep) => {
                const dur = ep.duration_seconds || localDurations[ep.path]
                const bm = bookmarks[ep.path]
                const bmPct = bm && dur && dur > 0 ? Math.min(100, (bm / dur) * 100) : 0
                const isNextUp = ep.id === nextUpEp?.id

                return (
                  <div
                    key={ep.id}
                    className={`episode-row${ep.watched ? ' episode-watched' : ''}${isNextUp ? ' episode-next-up' : ''}`}
                    onClick={() => playEpisode(ep)}
                  >
                    <button
                      className={`ep-watch-toggle${ep.watched ? ' watched' : ''}`}
                      onClick={(e) => toggleWatched(e, ep)}
                      title={ep.watched ? 'Mark unwatched' : 'Mark watched'}
                    >
                      {ep.watched ? '✓' : '○'}
                    </button>

                    <span className="ep-num">
                      {ep.episode_number != null ? `E${String(ep.episode_number).padStart(2, '0')}` : '-'}
                    </span>

                    <div className="ep-title-wrap">
                      <span className="ep-title">{ep.title ?? ep.path.split('/').pop()}</span>
                      {bmPct > 0 && (
                        <div className="ep-progress-track">
                          <div className="ep-progress-fill" style={{ width: `${bmPct}%` }} />
                        </div>
                      )}
                    </div>

                    {isNextUp && !ep.watched && (
                      <span className="ep-next-up-badge">Next</span>
                    )}

                    {dur && dur > 0 && (
                      <span className="ep-duration">{formatDur(dur)}</span>
                    )}

                    {bm && (
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
                )
              })}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>

    {posterPickerOpen && (
      <PosterPickerModal item={show} onClose={() => setPosterPickerOpen(false)} />
    )}
    </>
  )
}
