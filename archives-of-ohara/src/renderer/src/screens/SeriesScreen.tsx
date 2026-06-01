import { useEffect, useState, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store'
import MediaCard from '../components/MediaCard'
import ShowDetail from '../components/ShowDetail'
import PageWrapper from '../components/PageWrapper'
import SearchFilterBar, { type SortKey } from '../components/SearchFilterBar'
import type { MediaItem } from '../../../preload/index.d'

function displayTitle(item: MediaItem): string {
  return item.title_override ?? item.title
}

function titleSortKey(item: MediaItem): string {
  return displayTitle(item).replace(/^the\s+/i, '')
}

function compareItems(a: MediaItem, b: MediaItem, sort: SortKey, asc: boolean): number {
  if (sort === 'year') return asc ? (a.year ?? 0) - (b.year ?? 0) : (b.year ?? 0) - (a.year ?? 0)
  if (sort === 'rating') return asc ? (a.rating ?? 0) - (b.rating ?? 0) : (b.rating ?? 0) - (a.rating ?? 0)
  if (sort === 'last_watched') {
    if (!a.last_watched_at && !b.last_watched_at) return 0
    if (!a.last_watched_at) return 1
    if (!b.last_watched_at) return -1
    return asc ? a.last_watched_at.localeCompare(b.last_watched_at) : b.last_watched_at.localeCompare(a.last_watched_at)
  }
  const ka = titleSortKey(a), kb = titleSortKey(b)
  return asc ? ka.localeCompare(kb) : kb.localeCompare(ka)
}

function sortItems(items: MediaItem[], sort: SortKey, dir: 'asc' | 'desc'): MediaItem[] {
  const asc = dir === 'asc'
  const favs = items.filter((i) => i.favorite)
  const rest = items.filter((i) => !i.favorite)
  const cmp = (a: MediaItem, b: MediaItem) => compareItems(a, b, sort, asc)
  return [...favs.sort(cmp), ...rest.sort(cmp)]
}

export default function SeriesScreen() {
  const { shows, loadShows, mediaTags, nextEpisodes, loadNextEpisodes } = useStore()
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const selected = useMemo(() => shows.find((s) => s.id === selectedId) ?? null, [shows, selectedId])
  const [initialSeason, setInitialSeason] = useState<number | undefined>(undefined)
  const [query, setQuery] = useState('')
  const [activeTags, setActiveTags] = useState<number[]>([])
  const [filterMode, setFilterMode] = useState<'or' | 'and'>('or')
  const [sort, setSort] = useState<SortKey>('title')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const location = useLocation()

  useEffect(() => {
    loadShows()
    loadNextEpisodes()
  }, [])

  useEffect(() => {
    const state = location.state as { selectedShow?: number; selectedSeason?: number } | null
    if (state?.selectedShow && shows.length) {
      if (shows.some((s) => s.id === state.selectedShow)) {
        setSelectedId(state.selectedShow)
        setInitialSeason(state.selectedSeason)
        // Clear the state so future show reloads (e.g. after scan) don't re-open the panel
        navigate(location.pathname, { replace: true, state: null })
      }
    }
  }, [location.state, shows])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedId !== null) setSelectedId(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedId])

  const filtered = useMemo(() => {
    const base = shows.filter((show) => {
      if (query && !(show.title_override ?? show.title).toLowerCase().includes(query.toLowerCase())) return false
      if (activeTags.length === 0) return true
      const itemTags = mediaTags[show.id] ?? []
      return filterMode === 'or'
        ? activeTags.some((t) => itemTags.includes(t))
        : activeTags.every((t) => itemTags.includes(t))
    })
    return sortItems(base, sort, sortDir)
  }, [shows, query, activeTags, filterMode, mediaTags, sort, sortDir])

  const handleCardClick = (show: MediaItem) => {
    setSelectedId((prev) => (prev === show.id ? null : show.id))
    setInitialSeason(undefined)
  }

  const hasFilter = query !== '' || activeTags.length > 0

  return (
    <PageWrapper>
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Shows</h1>
          <div className="screen-subtitle">
            {hasFilter
              ? `${filtered.length} of ${shows.length} show${shows.length !== 1 ? 's' : ''}`
              : `${shows.length} show${shows.length !== 1 ? 's' : ''} in your archive`}
          </div>
        </div>
      </div>

      {shows.length > 0 && (
        <SearchFilterBar
          query={query}
          onQueryChange={setQuery}
          activeTags={activeTags}
          onTagsChange={setActiveTags}
          filterMode={filterMode}
          onFilterModeChange={setFilterMode}
          placeholder="Search shows…"
          sort={sort}
          onSortChange={setSort}
          sortDir={sortDir}
          onSortDirChange={setSortDir}
        />
      )}

      {shows.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📚</div>
          <div className="empty-state-title">The Archive is Empty</div>
          <div className="empty-state-text">
            Configure your TV Show folders in Settings, then scan your library to populate the archive.
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-title">No Matches Found</div>
          <div className="empty-state-text">Try adjusting your search or filters.</div>
        </div>
      ) : (
        <>
          <div className="media-grid">
            <AnimatePresence mode="popLayout">
              {filtered.map((show) => (
                <motion.div
                  key={show.id}
                  layout
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                >
                  <MediaCard
                    item={show}
                    nextEpisode={nextEpisodes[show.id] ?? null}
                    onClick={() => handleCardClick(show)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {selected && (
              <ShowDetail
                key={selected.id}
                show={selected}
                onClose={() => { setSelectedId(null); loadNextEpisodes() }}
                initialSeason={initialSeason}
              />
            )}
          </AnimatePresence>
        </>
      )}
    </PageWrapper>
  )
}
