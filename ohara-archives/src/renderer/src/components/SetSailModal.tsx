import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { tagColor } from './TagPicker'
import type { MediaItem } from '../../../preload/index.d'

interface Props {
  open: boolean
  onClose: () => void
  type: 'movie' | 'show'
}

export default function SetSailModal({ open, onClose, type }: Props) {
  const { shows, movies, tags, mediaTags } = useStore()
  const navigate = useNavigate()
  const [picked, setPicked] = useState<MediaItem | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [filterTagIds, setFilterTagIds] = useState<number[]>([])

  const allItems = type === 'show' ? shows : movies

  const pool = useMemo(() => {
    if (filterTagIds.length === 0) return allItems
    return allItems.filter((m) => {
      const itemTags = mediaTags[m.id] ?? []
      return filterTagIds.some((t) => itemTags.includes(t))
    })
  }, [allItems, filterTagIds, mediaTags])

  const toggleFilterTag = (tagId: number) => {
    setFilterTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  const roll = useCallback(() => {
    if (!pool.length) return
    setSpinning(true)
    setRotation((r) => r + 720 + Math.random() * 360)
    setTimeout(() => {
      const idx = Math.floor(Math.random() * pool.length)
      setPicked(pool[idx])
      setSpinning(false)
    }, 700)
  }, [pool])

  useEffect(() => {
    if (open && pool.length) roll()
  }, [open])

  useEffect(() => {
    if (!open) return
    if (pool.length) roll()
    else setPicked(null)
  }, [filterTagIds])

  const handleWatch = () => {
    if (!picked) return
    onClose()
    if (type === 'movie') {
      navigate('/player', { state: { path: picked.path, title: picked.title } })
    } else {
      navigate('/series', { state: { selectedShow: picked.id } })
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            className="sail-modal"
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          >
            <motion.span
              className="sail-wheel"
              animate={{ rotate: rotation }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            >
              ⚓
            </motion.span>

            <div className="sail-title">The Charts Are Set</div>
            <div style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 12, position: 'relative', zIndex: 1 }}>
              {type === 'show' ? 'Your next series awaits' : 'Tonight\'s voyage'}
            </div>

            {tags.length > 0 && (
              <div style={{ position: 'relative', zIndex: 1, marginBottom: 12, maxWidth: 340 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 6 }}>
                  Filter by tag
                  {filterTagIds.length > 0 && (
                    <button
                      onClick={() => setFilterTagIds([])}
                      style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 10, textDecoration: 'underline', padding: 0 }}
                    >
                      clear
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'center' }}>
                  {tags.map((tag) => {
                    const active = filterTagIds.includes(tag.id)
                    return (
                      <button
                        key={tag.id}
                        className={`tag-chip-btn ${active ? 'active' : ''}`}
                        style={active ? { borderColor: tagColor(tag.id), color: tagColor(tag.id), background: `${tagColor(tag.id)}22` } : {}}
                        onClick={() => toggleFilterTag(tag.id)}
                      >
                        {tag.name}
                      </button>
                    )
                  })}
                </div>
                {filterTagIds.length > 0 && pool.length === 0 && (
                  <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 6 }}>
                    No {type === 'show' ? 'series' : 'movies'} match these tags.
                  </div>
                )}
                {filterTagIds.length > 0 && pool.length > 0 && (
                  <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 6 }}>
                    {pool.length} {type === 'show' ? 'series' : pool.length === 1 ? 'film' : 'films'} in pool
                  </div>
                )}
              </div>
            )}

            <AnimatePresence mode="wait">
              {picked ? (
                <motion.div
                  key={picked.id}
                  className="sail-result-card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                >
                  {picked.poster_base64 && (
                    <img
                      src={picked.poster_base64}
                      alt={picked.title}
                      style={{
                        width: 80,
                        height: 120,
                        objectFit: 'cover',
                        borderRadius: 4,
                        margin: '0 auto 12px',
                        display: 'block',
                        border: '1px solid rgba(201,168,76,0.3)'
                      }}
                    />
                  )}
                  <div className="sail-result-title">{picked.title}</div>
                  <div className="sail-result-meta">
                    {picked.year && <span>{picked.year}</span>}
                    {picked.rating != null && picked.rating > 0 && (
                      <span className="rating-badge" style={{ marginLeft: 8 }}>
                        ★ {picked.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                </motion.div>
              ) : (
                <div className="sail-result-card" style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                    {pool.length === 0 ? 'No media found — scan your library first' : 'Charting course…'}
                  </div>
                </div>
              )}
            </AnimatePresence>

            <div className="sail-actions">
              <button
                className="btn btn-ghost"
                onClick={roll}
                disabled={spinning || !pool.length}
              >
                🧭 Change Course
              </button>
              <button
                className="btn btn-primary"
                onClick={handleWatch}
                disabled={!picked || spinning}
              >
                🏴‍☠️ All Hands on Deck
              </button>
            </div>

            <button
              onClick={onClose}
              style={{
                position: 'absolute',
                top: 12,
                right: 16,
                background: 'transparent',
                border: 'none',
                color: 'var(--text-dim)',
                fontSize: 18,
                cursor: 'pointer',
                zIndex: 2
              }}
            >
              ×
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
