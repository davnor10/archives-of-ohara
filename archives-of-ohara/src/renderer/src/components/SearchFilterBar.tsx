import { useRef, useState, useEffect } from 'react'
import { useStore } from '../store'
import { tagColor } from './TagPicker'

export type SortKey = 'title' | 'year' | 'rating' | 'last_watched'

interface Props {
  query: string
  onQueryChange: (q: string) => void
  activeTags: number[]
  onTagsChange: (tags: number[]) => void
  filterMode: 'or' | 'and'
  onFilterModeChange: (mode: 'or' | 'and') => void
  placeholder?: string
  sort?: SortKey
  onSortChange?: (s: SortKey) => void
  sortDir?: 'asc' | 'desc'
  onSortDirChange?: (d: 'asc' | 'desc') => void
}

export default function SearchFilterBar({
  query, onQueryChange,
  activeTags, onTagsChange,
  filterMode, onFilterModeChange,
  placeholder,
  sort, onSortChange,
  sortDir, onSortDirChange,
}: Props) {
  const { tags } = useStore()
  const [showTagMenu, setShowTagMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowTagMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggleTag = (tagId: number) => {
    onTagsChange(
      activeTags.includes(tagId)
        ? activeTags.filter((id) => id !== tagId)
        : [...activeTags, tagId]
    )
  }

  const defaults = tags.filter((t) => t.is_default)
  const custom = tags.filter((t) => !t.is_default)

  return (
    <div className="search-filter-bar">
      <div className="search-input-wrap">
        <span className="search-icon">⎈</span>
        <input
          className="search-input"
          type="text"
          placeholder={placeholder ?? 'Search…'}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        {query && (
          <button className="search-clear" onClick={() => onQueryChange('')}>×</button>
        )}
      </div>

      <div className="tag-filter-wrap" ref={menuRef}>
        <button
          className={`tag-filter-btn ${showTagMenu ? 'open' : ''} ${activeTags.length > 0 ? 'has-active' : ''}`}
          onClick={() => setShowTagMenu((v) => !v)}
        >
          🏷 Tags{activeTags.length > 0 && <span className="tag-filter-count">{activeTags.length}</span>}
        </button>

        {showTagMenu && (
          <div className="tag-filter-dropdown">
            <div className="tag-filter-section">
              {defaults.map((tag) => {
                const active = activeTags.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    className={`tag-dropdown-item ${active ? 'active' : ''}`}
                    style={active ? { color: tagColor(tag.id) } : {}}
                    onClick={() => toggleTag(tag.id)}
                  >
                    <span className="tag-dropdown-check">{active ? '✓' : ''}</span>
                    {tag.name}
                  </button>
                )
              })}
            </div>
            {custom.length > 0 && (
              <>
                <div className="tag-filter-divider">Custom</div>
                <div className="tag-filter-section">
                  {custom.map((tag) => {
                    const active = activeTags.includes(tag.id)
                    return (
                      <button
                        key={tag.id}
                        className={`tag-dropdown-item ${active ? 'active' : ''}`}
                        style={active ? { color: tagColor(tag.id) } : {}}
                        onClick={() => toggleTag(tag.id)}
                      >
                        <span className="tag-dropdown-check">{active ? '✓' : ''}</span>
                        {tag.name}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {activeTags.map((tagId) => {
        const tag = tags.find((t) => t.id === tagId)
        if (!tag) return null
        const c = tagColor(tagId)
        return (
          <span
            key={tagId}
            className="active-tag-chip"
            style={{ borderColor: c, color: c, background: `${c}1a` }}
          >
            {tag.name}
            <button onClick={() => toggleTag(tagId)}>×</button>
          </span>
        )
      })}

      {onSortChange && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          <select
            className="sort-select"
            value={sort ?? 'title'}
            onChange={(e) => onSortChange(e.target.value as SortKey)}
          >
            <option value="title">Title</option>
            <option value="year">Year</option>
            <option value="rating">Rating</option>
            <option value="last_watched">Last Watched</option>
          </select>
          {onSortDirChange && (
            <button
              className="sort-dir-btn"
              onClick={() => onSortDirChange(sortDir === 'asc' ? 'desc' : 'asc')}
              title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortDir === 'asc' ? '↑' : '↓'}
            </button>
          )}
        </div>
      )}

      {activeTags.length >= 2 && (
        <button
          className="filter-mode-toggle"
          onClick={() => onFilterModeChange(filterMode === 'or' ? 'and' : 'or')}
          title={filterMode === 'or' ? 'Matching ANY tag - click to require ALL' : 'Matching ALL tags - click to match ANY'}
        >
          {filterMode.toUpperCase()}
        </button>
      )}
    </div>
  )
}
