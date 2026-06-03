import { useNavigate } from 'react-router-dom'

interface Props {
  onClose: () => void
}

export default function GettingStartedModal({ onClose }: Props) {
  const navigate = useNavigate()

  const goToSettings = () => {
    onClose()
    navigate('/settings')
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }}>
      <div className="sail-modal" style={{ width: 520, maxHeight: '80vh', overflowY: 'auto', textAlign: 'left' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>

          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)', marginBottom: 4, fontFamily: 'Cinzel, serif', letterSpacing: '0.05em' }}>
            Welcome to Archives of Ohara
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
            Your personal media library, built in the spirit of the world's greatest archive.
            Here's how to get started in three steps.
          </div>

          <Step number="1" title="Add your media folders">
            <p>Open <strong style={{ color: 'var(--parchment)' }}>Settings</strong> and add the folders where your TV shows and movies live.
            You can add as many folders as you like — on any connected drive.</p>
          </Step>

          <Step number="2" title="Get a free TMDB API key (optional but recommended)">
            <p>
              The <strong style={{ color: 'var(--parchment)' }}>TMDB API key</strong> lets the app fetch posters, titles, and descriptions for your media.
              It's completely free — just create an account at{' '}
              <strong style={{ color: 'var(--seafoam)' }}>themoviedb.org</strong>,
              go to Settings → API, and copy your key into the API Key field in Settings here.
            </p>
          </Step>

          <Step number="3" title="Scan your library">
            <p>
              Hit <strong style={{ color: 'var(--parchment)' }}>Save & Scan Library</strong> in Settings (or the <strong style={{ color: 'var(--parchment)' }}>⟳ Scan</strong> button in the toolbar)
              to index your files. After scanning, click{' '}
              <strong style={{ color: 'var(--parchment)' }}>🎬 Refresh Metadata</strong> to pull in posters and info from TMDB.
            </p>
          </Step>

          <div style={{ marginTop: 28, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={goToSettings}>
              Go to Settings
            </button>
            <button className="btn btn-ghost" onClick={onClose}>
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Step({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
      <div style={{
        flexShrink: 0,
        width: 28, height: 28,
        borderRadius: '50%',
        background: 'rgba(var(--teal-dark-rgb), 0.8)',
        border: '1px solid rgba(126,202,195,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color: 'var(--seafoam)',
        fontFamily: 'Cinzel, serif',
      }}>
        {number}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--parchment)', marginBottom: 5 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.65 }}>{children}</div>
      </div>
    </div>
  )
}
