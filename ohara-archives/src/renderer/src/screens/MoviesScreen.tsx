import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import MediaCard from '../components/MediaCard'
import PageWrapper from '../components/PageWrapper'
import SearchFilterBar, { type SortKey } from '../components/SearchFilterBar'
import type { MediaItem } from '../../../preload/index.d'

function sortItems(items: MediaItem[], sort: SortKey, dir: 'asc' | 'desc'): MediaItem[] {
  const asc = dir === 'asc'
  return [...items].sort((a, b) => {
    if (sort === 'year') {
      return asc ? (a.year ?? 0) - (b.year ?? 0) : (b.year ?? 0) - (a.year ?? 0)
    }
    if (sort === 'rating') {
      return asc ? (a.rating ?? 0) - (b.rating ?? 0) : (b.rating ?? 0) - (a.rating ?? 0)
    }
    if (sort === 'last_watched') {
      // nulls always at the end
      if (!a.last_watched_at && !b.last_watched_at) return 0
      if (!a.last_watched_at) return 1
      if (!b.last_watched_at) return -1
      return asc
        ? a.last_watched_at.localeCompare(b.last_watched_at)
        : b.last_watched_at.localeCompare(a.last_watched_at)
    }
    // title (default)
    return asc
      ? a.title.localeCompare(b.title)
      : b.title.localeCompare(a.title)
  })
}

export default function MoviesScreen() {
  const { movies, loadMovies, mediaTags, bookmarks, removeBookmark } = useStore()
  const [query, setQuery] = useState('')
  const [activeTags, setActiveTags] = useState<number[]>([])
  const [filterMode, setFilterMode] = useState<'or' | 'and'>('or')
  const [sort, setSort] = useState<SortKey>('title')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const navigate = useNavigate()

  useEffect(() => { loadMovies() }, [])

  const filtered = useMemo(() => {
    const base = movies.filter((movie) => {
      if (query && !movie.title.toLowerCase().includes(query.toLowerCase())) return false
      if (activeTags.length === 0) return true
      const itemTags = mediaTags[movie.id] ?? []
      return filterMode === 'or'
        ? activeTags.some((t) => itemTags.includes(t))
        : activeTags.every((t) => itemTags.includes(t))
    })
    return sortItems(base, sort, sortDir)
  }, [movies, query, activeTags, filterMode, mediaTags, sort, sortDir])

  const handlePlay = (movie: MediaItem) => {
    navigate('/player', {
      state: {
        path: movie.path,
        title: movie.title,
        year: movie.year,
        durationSeconds: movie.duration_seconds
      }
    })
  }

  const hasFilter = query !== '' || activeTags.length > 0

  return (
    <PageWrapper>
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Movies</h1>
          <div className="screen-subtitle">
            {hasFilter
              ? `${filtered.length} of ${movies.length} film${movies.length !== 1 ? 's' : ''}`
              : `${movies.length} film${movies.length !== 1 ? 's' : ''} in your archive`}
          </div>
        </div>
      </div>

      {movies.length > 0 && (
        <SearchFilterBar
          query={query}
          onQueryChange={setQuery}
          activeTags={activeTags}
          onTagsChange={setActiveTags}
          filterMode={filterMode}
          onFilterModeChange={setFilterMode}
          placeholder="Search movies…"
          sort={sort}
          onSortChange={setSort}
          sortDir={sortDir}
          onSortDirChange={setSortDir}
        />
      )}

      {movies.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎬</div>
          <div className="empty-state-title">No Films Charted</div>
          <div className="empty-state-text">
            Configure your Movies folders in Settings, then scan your library to populate the archive.
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-title">No Matches Found</div>
          <div className="empty-state-text">Try adjusting your search or filters.</div>
        </div>
      ) : (
        <div className="media-grid">
          {filtered.map((movie) => (
            <MediaCard
              key={movie.id}
              item={movie}
              hasBookmark={!!bookmarks[movie.path]}
              onRemoveBookmark={() => removeBookmark(movie.path)}
              onClick={() => handlePlay(movie)}
            />
          ))}
        </div>
      )}
    </PageWrapper>
  )
}
