import { useEffect, useRef } from 'react'
import { useStore } from '../store'

const TAG_PALETTE = [
  '#7ecac3', '#c9a84c', '#5ba4cf', '#c97b9e',
  '#7eca9c', '#a07bc9', '#ca9f7b', '#79aeca'
]

export function tagColor(id: number): string {
  return TAG_PALETTE[id % TAG_PALETTE.length]
}

interface Props {
  mediaId: number
  onClose?: () => void
}

export default function TagPicker({ mediaId, onClose }: Props) {
  const { tags, mediaTags, setMediaTags } = useStore()
  const current = mediaTags[mediaId] ?? []
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!onClose) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const toggle = (tagId: number) => {
    const next = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId]
    setMediaTags(mediaId, next)
  }

  const defaults = tags.filter((t) => t.is_default)
  const custom = tags.filter((t) => !t.is_default)

  return (
    <div ref={ref} className="tag-picker-panel" onClick={(e) => e.stopPropagation()}>
      <div className="tag-picker-grid">
        {defaults.map((tag) => {
          const active = current.includes(tag.id)
          return (
            <button
              key={tag.id}
              className={`tag-chip-btn ${active ? 'active' : ''}`}
              style={active ? { borderColor: tagColor(tag.id), color: tagColor(tag.id), background: `${tagColor(tag.id)}22` } : {}}
              onClick={() => toggle(tag.id)}
            >
              {tag.name}
            </button>
          )
        })}
      </div>
      {custom.length > 0 && (
        <>
          <div className="tag-picker-section-label">Custom</div>
          <div className="tag-picker-grid">
            {custom.map((tag) => {
              const active = current.includes(tag.id)
              return (
                <button
                  key={tag.id}
                  className={`tag-chip-btn ${active ? 'active' : ''}`}
                  style={active ? { borderColor: tagColor(tag.id), color: tagColor(tag.id), background: `${tagColor(tag.id)}22` } : {}}
                  onClick={() => toggle(tag.id)}
                >
                  {tag.name}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
