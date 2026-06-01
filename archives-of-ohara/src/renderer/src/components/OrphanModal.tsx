import { useState } from 'react'
import type { OrphanEntry } from '../../../preload/index.d'
import { useStore } from '../store'

interface Props {
  orphans: OrphanEntry[]
  onClose: () => void
}

export default function OrphanModal({ orphans, onClose }: Props) {
  const { loadShows, loadMovies } = useStore()
  const [busy, setBusy] = useState(false)

  const episodeIds = orphans.filter((o) => o.type === 'episode').map((o) => o.id)
  const movieIds = orphans.filter((o) => o.type === 'movie').map((o) => o.id)

  const handleClean = async () => {
    setBusy(true)
    await window.api.cleanOrphans(episodeIds, movieIds)
    await Promise.all([loadShows(), loadMovies()])
    onClose()
  }

  const episodes = orphans.filter((o) => o.type === 'episode')
  const movies = orphans.filter((o) => o.type === 'movie')

  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }}>
      <div className="sail-modal" style={{ width: 520, textAlign: 'left', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--parchment)', marginBottom: 6 }}>
            Missing Files
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
            {orphans.length} item{orphans.length !== 1 ? 's' : ''} could not be found on disk.
            If your drive is connected and these files are genuinely gone, delete them from your library.
            If your drive is offline, close this and they'll disappear once you reconnect and scan.
          </div>

          <div style={{ overflowY: 'auto', flex: 1, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {episodes.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 6 }}>
                  Episodes ({episodes.length})
                </div>
                {episodes.map((o) => (
                  <div key={o.id} style={{ padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: 13, color: 'var(--parchment)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {o.showTitle ? <><span style={{ color: 'var(--text-dim)' }}>{o.showTitle} - </span>{o.title}</> : o.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {o.path}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {movies.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 6 }}>
                  Movies ({movies.length})
                </div>
                {movies.map((o) => (
                  <div key={o.id} style={{ padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: 13, color: 'var(--parchment)' }}>{o.title}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {o.path}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={handleClean} disabled={busy}>
              {busy ? 'Removing…' : `Remove ${orphans.length} item${orphans.length !== 1 ? 's' : ''} from library`}
            </button>
            <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
