import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import MediaCard from '../components/MediaCard'
import PageWrapper from '../components/PageWrapper'
import SearchFilterBar from '../components/SearchFilterBar'
import type { MediaItem } from '../../../preload/index.d'

export default function MoviesScreen() {
  const { movies, loadMovies, mediaTags } = useStore()
  const [query, setQuery] = useState('')
  const [activeTags, setActiveTags] = useState<number[]>([])
  const [filterMode, setFilterMode] = useState<'or' | 'and'>('or')
  const navigate = useNavigate()

  useEffect(() => { loadMovies() }, [])

  const filtered = useMemo(() => {
    return movies.filter((movie) => {
      if (query && !movie.title.toLowerCase().includes(query.toLowerCase())) return false
      if (activeTags.length === 0) return true
      const itemTags = mediaTags[movie.id] ?? []
      return filterMode === 'or'
        ? activeTags.some((t) => itemTags.includes(t))
        : activeTags.every((t) => itemTags.includes(t))
    })
  }, [movies, query, activeTags, filterMode, mediaTags])

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
              onClick={() => handlePlay(movie)}
            />
          ))}
        </div>
      )}
    </PageWrapper>
  )
}
