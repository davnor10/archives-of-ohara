interface Props {
  version: string
  ready: boolean
  onInstall: () => void
  onIgnore: () => void
}

export default function UpdateModal({ version, ready, onInstall, onIgnore }: Props) {
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
              onClick={onInstall}
              disabled={!ready}
            >
              {ready ? 'Restart & Install' : '⟳ Downloading…'}
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
