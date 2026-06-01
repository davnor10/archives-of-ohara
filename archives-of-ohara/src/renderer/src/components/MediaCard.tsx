import { useState, useRef, useEffect, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MediaItem, Episode } from '../../../preload/index.d'
import PlaceholderPoster from './PlaceholderPoster'
import TagPicker, { tagColor } from './TagPicker'
import PosterPickerModal from './PosterPickerModal'
import { useStore } from '../store'

interface Props {
  item: MediaItem
  hasBookmark?: boolean
  onRemoveBookmark?: () => void
  nextEpisode?: Episode | null
  onClick: () => void
}

function formatNextEp(ep: Episode): string {
  const s = `S${ep.season}`
  const e = ep.episode_number != null ? `:E${ep.episode_number}` : ''
  const parts = [s + e, ep.title].filter(Boolean)
  return parts.join(' · ')
}

function formatDur(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function MediaCard({ item, hasBookmark, onRemoveBookmark, nextEpisode, onClick }: Props) {
  const { tags, mediaTags, setFavorite, updateLastWatched } = useStore()
  const navigate = useNavigate()
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [posterPickerOpen, setPosterPickerOpen] = useState(false)
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 })
  const cardRef = useRef<HTMLDivElement>(null)

  const itemTagIds = mediaTags[item.id] ?? []
  const itemTags = itemTagIds.map((id) => tags.find((t) => t.id === id)).filter(Boolean) as typeof tags

  const openTagPicker = (e: React.MouseEvent) => {
    e.stopPropagation()
    setTagPickerOpen(true)
  }

  // Keep picker anchored to card while the page scrolls
  useEffect(() => {
    if (!tagPickerOpen) return
    const update = () => {
      const rect = cardRef.current?.getBoundingClientRect()
      if (!rect) return
      setPickerPos({ top: rect.bottom + 6, left: Math.min(rect.left, window.innerWidth - 330) })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [tagPickerOpen])

  return (
    <>
      <div ref={cardRef} className="media-card" onClick={onClick} title={item.title_override ?? item.title}>
        {item.poster_base64 ? (
          <img className="media-card-poster" src={item.poster_base64} alt={item.title_override ?? item.title} loading="lazy" />
        ) : (
          <PlaceholderPoster title={item.title_override ?? item.title} />
        )}
        <div className="media-card-info">
          <div className="media-card-title">{item.title_override ?? item.title}</div>
          <div className="media-card-meta">
            {item.year && <span>{item.year}</span>}
            {item.rating != null && item.rating > 0 && (
              <span className="rating-badge" style={{ marginLeft: 6 }}>
                ★ {item.rating.toFixed(1)}
              </span>
            )}
          </div>
          {item.duration_seconds && item.duration_seconds > 0 && (
            <div className="media-card-duration">{formatDur(item.duration_seconds)}</div>
          )}
          {itemTags.length > 0 && (
            <div className="media-card-tags">
              {itemTags.slice(0, 3).map((tag) => (
                <span key={tag.id} className="card-tag" style={{ color: tagColor(tag.id) }}>
                  {tag.name}
                </span>
              ))}
              {itemTags.length > 3 && (
                <span className="card-tag-more">+{itemTags.length - 3}</span>
              )}
            </div>
          )}
          <div className="card-actions">
            <button
              className={`card-fav-btn${item.favorite ? ' active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setFavorite(item.id, item.type, !item.favorite) }}
              title={item.favorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              {item.favorite ? '★' : '☆'}
            </button>
            <button className="card-poster-btn" onClick={(e) => { e.stopPropagation(); setPosterPickerOpen(true) }} title="Change poster">🖼</button>
            <button className="card-tag-btn" onClick={openTagPicker} title="Edit tags">🏷</button>
          </div>

          {nextEpisode && (
            <div className="card-play-row">
              {(() => {
                const isStart = (nextEpisode.watched_count ?? 0) === 0
                  || (nextEpisode.total_count != null && (nextEpisode.watched_count ?? 0) >= nextEpisode.total_count)
                return (
                  <button
                    className={`card-play-btn ${isStart ? 'card-play-btn--start' : 'card-play-btn--continue'}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      updateLastWatched(nextEpisode.path)
                      navigate('/player', {
                        state: {
                          path: nextEpisode.path,
                          isEpisode: true,
                          durationSeconds: nextEpisode.duration_seconds,
                          showId: item.id,
                          seasonNumber: nextEpisode.season,
                          autoSubtitleOverride: item.auto_subtitle ?? null,
                          title: `${item.title_override ?? item.title} - ${formatNextEp(nextEpisode)}`,
                        }
                      })
                    }}
                  >
                    {isStart ? '▶ Start watching' : '▶ Continue watching'}
                  </button>
                )
              })()}
            </div>
          )}
        </div>
        {(item.missing_count ?? 0) > 0 && (
          <div
            className="media-card-offline-badge"
            title={item.type === 'show'
              ? `${item.missing_count} episode${item.missing_count === 1 ? '' : 's'} not found on disk`
              : 'File not found on disk'}
          >
            ⚠
          </div>
        )}

        {hasBookmark && (
          <div className="media-card-bookmark-wrap">
            <span className="media-card-bookmark">🔖</span>
            {onRemoveBookmark && (
              <button
                className="media-card-bookmark-remove"
                onClick={(e) => { e.stopPropagation(); onRemoveBookmark() }}
                title="Remove bookmark"
              >
                ×
              </button>
            )}
          </div>
        )}
      </div>

      {tagPickerOpen && (
        <div
          style={{ position: 'fixed', top: pickerPos.top, left: pickerPos.left, zIndex: 1000 }}
        >
          <TagPicker mediaId={item.id} onClose={() => setTagPickerOpen(false)} />
        </div>
      )}

      {posterPickerOpen && (
        <PosterPickerModal item={item} onClose={() => setPosterPickerOpen(false)} />
      )}
    </>
  )
}

export default memo(MediaCard, (prev, next) =>
  prev.item === next.item &&
  prev.hasBookmark === next.hasBookmark &&
  prev.nextEpisode === next.nextEpisode
)
