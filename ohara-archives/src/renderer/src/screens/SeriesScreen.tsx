import { useEffect, useState, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useStore } from '../store'
import MediaCard from '../components/MediaCard'
import ShowDetail from '../components/ShowDetail'
import PageWrapper from '../components/PageWrapper'
import SearchFilterBar from '../components/SearchFilterBar'
import type { MediaItem } from '../../../preload/index.d'

export default function SeriesScreen() {
  const { shows, loadShows, mediaTags } = useStore()
  const [selected, setSelected] = useState<MediaItem | null>(null)
  const [query, setQuery] = useState('')
  const [activeTags, setActiveTags] = useState<number[]>([])
  const [filterMode, setFilterMode] = useState<'or' | 'and'>('or')
  const location = useLocation()

  useEffect(() => { loadShows() }, [])

  useEffect(() => {
    const state = location.state as { selectedShow?: number } | null
    if (state?.selectedShow && shows.length) {
      const show = shows.find((s) => s.id === state.selectedShow)
      if (show) setSelected(show)
    }
  }, [location.state, shows])

  const filtered = useMemo(() => {
    return shows.filter((show) => {
      if (query && !show.title.toLowerCase().includes(query.toLowerCase())) return false
      if (activeTags.length === 0) return true
      const itemTags = mediaTags[show.id] ?? []
      return filterMode === 'or'
        ? activeTags.some((t) => itemTags.includes(t))
        : activeTags.every((t) => itemTags.includes(t))
    })
  }, [shows, query, activeTags, filterMode, mediaTags])

  const handleCardClick = (show: MediaItem) => {
    setSelected((prev) => (prev?.id === show.id ? null : show))
  }

  const hasFilter = query !== '' || activeTags.length > 0

  return (
    <PageWrapper>
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Series</h1>
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
          placeholder="Search series…"
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
            {filtered.map((show) => (
              <MediaCard
                key={show.id}
                item={show}
                onClick={() => handleCardClick(show)}
              />
            ))}
          </div>

          <AnimatePresence>
            {selected && (
              <ShowDetail
                key={selected.id}
                show={selected}
                onClose={() => setSelected(null)}
              />
            )}
          </AnimatePresence>
        </>
      )}
    </PageWrapper>
  )
}
