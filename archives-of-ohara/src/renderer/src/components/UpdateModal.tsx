import { useState } from 'react'
import Spinner from './Spinner'

interface Props {
  version: string
  ready: boolean
  onInstall: () => void
  onIgnore: () => void
}

export default function UpdateModal({ version, ready, onInstall, onIgnore }: Props) {
  const [installing, setInstalling] = useState(false)

  const handleInstall = () => {
    setInstalling(true)
    onInstall()
  }

  if (installing) {
    return (
      <div className="modal-overlay" style={{ zIndex: 2000 }}>
        <div className="sail-modal" style={{ width: 420, textAlign: 'center' }}>
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '8px 0' }}>
            <Spinner size="lg" />
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--parchment)', letterSpacing: '0.04em' }}>
              Updating…
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }}>
      <div className="sail-modal" style={{ width: 420, textAlign: 'left' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--parchment)', marginBottom: 8 }}>
            Update Available
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
            {ready
              ? <>Version <strong style={{ color: 'var(--seafoam)' }}>v{version}</strong> is downloaded and ready to install. Restart now to apply the update.</>
              : <>Version <strong style={{ color: 'var(--seafoam)' }}>v{version}</strong> is available and downloading in the background…</>
            }
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn btn-primary"
              onClick={handleInstall}
              disabled={!ready}
            >
              {ready ? 'Restart & Install' : <><span className="spin-icon">⟳</span> Downloading…</>}
            </button>
            <button className="btn btn-ghost" onClick={onIgnore}>
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
