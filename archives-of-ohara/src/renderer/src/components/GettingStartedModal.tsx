import { useState, useEffect } from 'react'
import { useStore } from '../store'

interface Props {
  onClose: () => void
}

const STEPS = ['intro', 'folders', 'tmdb', 'features', 'shortcuts', 'finish'] as const
type StepId = (typeof STEPS)[number]

const STEP_LABELS: Record<StepId, string> = {
  intro: 'Library Structure',
  folders: 'Root Folders',
  tmdb: 'Metadata',
  features: 'Features',
  shortcuts: 'Shortcuts',
  finish: 'All Set',
}

// Keep this in sync with what the app can actually do - see CLAUDE.md for the reminder.
const FEATURES: { icon: string; title: string; desc: string }[] = [
  { icon: '🎲', title: 'Set Sail', desc: "Randomly pick something to watch from your library, optionally filtered by tags or favorites." },
  { icon: '🏷️', title: 'Tags & Filters', desc: 'Organize your shows and movies with built-in and custom tags, then filter your library by them.' },
  { icon: '🔖', title: 'Resume Playback', desc: 'Your position is bookmarked automatically as you watch, so you can pick up right where you left off.' },
  { icon: '💬', title: 'Subtitles', desc: 'Subtitles auto-load, and their size, color, and background box are all customizable in Settings.' },
  { icon: '🎨', title: 'Themes & Scale', desc: 'Choose from several dark and light color themes, and resize the whole interface to taste.' },
  { icon: '⚠️', title: 'Library Health', desc: 'Detect entries whose files have gone missing - like an unplugged drive - and clean them up safely.' },
  { icon: '🎬', title: 'Metadata Refresh', desc: 'Re-fetch posters, ratings, and descriptions from TMDB for your whole library any time.' },
  { icon: '⭐', title: 'Favorites', desc: 'Mark titles as favorites for quick access and for Set Sail filtering.' },
  { icon: '🔄', title: 'Auto-Updates', desc: 'The app checks for new versions on launch and installs them with one click.' },
]

const SHORTCUTS: { key: string; desc: string }[] = [
  { key: 'Space', desc: 'Play / pause the current video' },
  { key: '→', desc: 'Skip forward 10 seconds' },
  { key: '←', desc: 'Skip back 10 seconds' },
  { key: 'F', desc: 'Toggle fullscreen' },
  { key: 'M', desc: 'Toggle mute' },
  { key: 'L', desc: 'Cycle audio language/track' },
  { key: 'S', desc: 'Cycle subtitle tracks (including off)' },
  { key: 'C', desc: 'Toggle subtitles on / off' },
  { key: 'Esc', desc: 'Close a menu, exit fullscreen, or leave the player' },
]

export default function GettingStartedModal({ onClose }: Props) {
  const { settings, saveSettings } = useStore()
  const [stepIndex, setStepIndex] = useState(0)
  const [showPaths, setShowPaths] = useState<string[]>([])
  const [moviePaths, setMoviePaths] = useState<string[]>([])
  const [tmdbKey, setTmdbKey] = useState('')

  useEffect(() => {
    setShowPaths(settings.show_paths ?? [])
    setMoviePaths(settings.movie_paths ?? [])
    setTmdbKey(settings.tmdb_api_key ?? '')
  }, [settings])

  const step = STEPS[stepIndex]
  const isFirst = stepIndex === 0
  const isLast = stepIndex === STEPS.length - 1

  const next = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))
  const back = () => setStepIndex((i) => Math.max(i - 1, 0))

  const addFolder = async (type: 'show' | 'movie') => {
    const folder = await window.api.selectFolder()
    if (!folder) return
    if (type === 'show') {
      const newPaths = [...new Set([...showPaths, folder])]
      setShowPaths(newPaths)
      saveSettings({ show_paths: newPaths })
    } else {
      const newPaths = [...new Set([...moviePaths, folder])]
      setMoviePaths(newPaths)
      saveSettings({ movie_paths: newPaths })
    }
  }

  const removePath = (type: 'show' | 'movie', path: string) => {
    if (type === 'show') {
      const newPaths = showPaths.filter((x) => x !== path)
      setShowPaths(newPaths)
      saveSettings({ show_paths: newPaths })
    } else {
      const newPaths = moviePaths.filter((x) => x !== path)
      setMoviePaths(newPaths)
      saveSettings({ movie_paths: newPaths })
    }
  }

  const nextLabel =
    (step === 'folders' && showPaths.length === 0 && moviePaths.length === 0) ||
    (step === 'tmdb' && !tmdbKey)
      ? 'Skip for now'
      : 'Continue'

  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }}>
      <div className="sail-modal" style={{ width: 600, maxHeight: '82vh', overflowY: 'auto', textAlign: 'left' }}>
        <button className="tutorial-modal-close" onClick={onClose} title="Close">✕</button>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="tutorial-progress">
            {STEPS.map((s, i) => (
              <div key={s} className={`tutorial-dot${i === stepIndex ? ' active' : i < stepIndex ? ' done' : ''}`} />
            ))}
          </div>
          <div className="tutorial-step-label">Step {stepIndex + 1} of {STEPS.length} · {STEP_LABELS[step]}</div>

          {step === 'intro' && (
            <>
              <div className="sail-title" style={{ textAlign: 'left', marginBottom: 4 }}>Welcome to Archives of Ohara</div>
              <p style={{ color: 'var(--text-mid)', fontSize: 13, lineHeight: 1.7, marginBottom: 18 }}>
                Your personal media library, built in the spirit of the world's greatest archive.
                Before you dive in, here's how it expects your files to be organized.
              </p>
              <div className="tutorial-feature-list">
                <div className="tutorial-feature-item">
                  <span className="tutorial-feature-icon">📺</span>
                  <div>
                    <div className="tutorial-feature-title">Shows root folder</div>
                    <div className="tutorial-feature-desc">
                      Point the app at one folder that contains all your series - each series needs its own
                      subfolder inside it (e.g. <strong style={{ color: 'var(--parchment)' }}>Shows/One Piece/…</strong>).
                      Everything inside that subfolder - seasons, episodes - is scanned automatically.
                    </div>
                  </div>
                </div>
                <div className="tutorial-feature-item">
                  <span className="tutorial-feature-icon">🎬</span>
                  <div>
                    <div className="tutorial-feature-title">Movies root folder</div>
                    <div className="tutorial-feature-desc">
                      Point the app at a folder containing your movies - the structure inside it doesn't matter.
                      Flat, nested by genre, whatever you already have works, since every video file inside is found.
                    </div>
                  </div>
                </div>
              </div>
              <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 18, marginBottom: 0 }}>
                You can add more than one root folder of each kind - even across different drives.
              </p>
            </>
          )}

          {step === 'folders' && (
            <>
              <div className="sail-title" style={{ textAlign: 'left', marginBottom: 4 }}>Add your root folders</div>
              <p style={{ color: 'var(--text-mid)', fontSize: 13, lineHeight: 1.6, marginBottom: 18 }}>
                Add as many Shows and Movies root folders as you like - you can also skip this and set it up later in Settings.
              </p>

              <div className="settings-section">
                <div className="settings-section-title">TV Show Folders</div>
                <div className="path-list">
                  {showPaths.map((p) => (
                    <div className="path-item" key={p}>
                      <span className="path-item-text">{p}</span>
                      <button className="path-item-remove" onClick={() => removePath('show', p)}>✕</button>
                    </div>
                  ))}
                  {showPaths.length === 0 && <div className="settings-empty">No folders configured.</div>}
                </div>
                <button className="btn btn-ghost settings-add-btn" onClick={() => addFolder('show')}>+ Add Folder</button>
              </div>

              <div className="settings-section">
                <div className="settings-section-title">Movie Folders</div>
                <div className="path-list">
                  {moviePaths.map((p) => (
                    <div className="path-item" key={p}>
                      <span className="path-item-text">{p}</span>
                      <button className="path-item-remove" onClick={() => removePath('movie', p)}>✕</button>
                    </div>
                  ))}
                  {moviePaths.length === 0 && <div className="settings-empty">No folders configured.</div>}
                </div>
                <button className="btn btn-ghost settings-add-btn" onClick={() => addFolder('movie')}>+ Add Folder</button>
              </div>
            </>
          )}

          {step === 'tmdb' && (
            <>
              <div className="sail-title" style={{ textAlign: 'left', marginBottom: 4 }}>Posters & metadata via TMDB</div>
              <p style={{ color: 'var(--text-mid)', fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>
                Archives of Ohara can automatically fetch posters, ratings, and descriptions for your library using{' '}
                <strong style={{ color: 'var(--parchment)' }}>The Movie Database (TMDB)</strong>, a free, community-run
                movie and TV database. This is optional, but recommended - without a key, your titles will show up
                with no artwork or details.
              </p>

              <div className="settings-section">
                <div className="settings-section-title">Getting a free API key</div>
                <ol style={{ margin: 0, paddingLeft: 20, color: 'var(--text-mid)', fontSize: 13, lineHeight: 1.9 }}>
                  <li>Create a free account at <strong style={{ color: 'var(--seafoam)' }}>themoviedb.org/signup</strong> and verify your email.</li>
                  <li>Go to <strong style={{ color: 'var(--parchment)' }}>Settings → API</strong> on TMDB's site.</li>
                  <li>Click <strong style={{ color: 'var(--parchment)' }}>Request an API Key</strong>, choose <strong style={{ color: 'var(--parchment)' }}>Developer</strong>, and accept the terms - it's free forever.</li>
                  <li>Fill in the short application form. No real project yet? Any URL works, even your GitHub profile - it's approved instantly.</li>
                  <li>Copy the <strong style={{ color: 'var(--parchment)' }}>API Key (v3 auth)</strong> value and paste it below.</li>
                </ol>
              </div>

              <div className="settings-section">
                <label className="settings-label" htmlFor="tutorial-tmdb-key">API Key</label>
                <input
                  id="tutorial-tmdb-key"
                  className="settings-input"
                  type="password"
                  placeholder="Enter your TMDB API key…"
                  value={tmdbKey}
                  onChange={(e) => setTmdbKey(e.target.value)}
                  onBlur={(e) => saveSettings({ tmdb_api_key: e.target.value })}
                />
                <div className="settings-hint settings-hint--field">
                  You can add or change this later in Settings → Library.
                </div>
              </div>
            </>
          )}

          {step === 'features' && (
            <>
              <div className="sail-title" style={{ textAlign: 'left', marginBottom: 4 }}>Everything else it can do</div>
              <p style={{ color: 'var(--text-mid)', fontSize: 13, lineHeight: 1.6, marginBottom: 18 }}>
                A quick tour of the rest of the app.
              </p>
              <div className="tutorial-feature-list">
                {FEATURES.map((f) => (
                  <div className="tutorial-feature-item" key={f.title}>
                    <span className="tutorial-feature-icon">{f.icon}</span>
                    <div>
                      <div className="tutorial-feature-title">{f.title}</div>
                      <div className="tutorial-feature-desc">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 'shortcuts' && (
            <>
              <div className="sail-title" style={{ textAlign: 'left', marginBottom: 4 }}>Keyboard shortcuts</div>
              <p style={{ color: 'var(--text-mid)', fontSize: 13, lineHeight: 1.6, marginBottom: 18 }}>
                These work whenever a video is playing.
              </p>
              <div className="tutorial-shortcut-list">
                {SHORTCUTS.map((s) => (
                  <div className="tutorial-shortcut-row" key={s.key}>
                    <span className="tutorial-key">{s.key}</span>
                    <span className="tutorial-shortcut-desc">{s.desc}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 'finish' && (
            <>
              <div className="sail-title" style={{ textAlign: 'left', marginBottom: 4 }}>You're all set</div>
              <p style={{ color: 'var(--text-mid)', fontSize: 13, lineHeight: 1.7, marginBottom: 8 }}>
                Hit <strong style={{ color: 'var(--parchment)' }}>⟳ Scan</strong> in the toolbar to index your library,
                then <strong style={{ color: 'var(--parchment)' }}>🎬 Refresh Metadata</strong> in Settings to pull in
                posters and info from TMDB.
              </p>
              <p style={{ color: 'var(--text-dim)', fontSize: 12.5, lineHeight: 1.7 }}>
                You can come back to this guide any time from the <strong style={{ color: 'var(--parchment)' }}>?</strong> button
                in the top toolbar.
              </p>
            </>
          )}

          <div className="tutorial-nav">
            <button className="btn btn-ghost" onClick={back} style={{ visibility: isFirst ? 'hidden' : 'visible' }}>
              ← Back
            </button>
            {isLast ? (
              <button className="btn btn-primary" onClick={onClose}>Finish</button>
            ) : (
              <button className="btn btn-primary" onClick={next}>{nextLabel} →</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
