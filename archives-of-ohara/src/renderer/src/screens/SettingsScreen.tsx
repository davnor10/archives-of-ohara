import { useEffect, useState } from 'react'
import { useStore } from '../store'
import PageWrapper from '../components/PageWrapper'
import { tagColor } from '../components/TagPicker'
import OrphanModal from '../components/OrphanModal'
import type { OrphanEntry } from '../../../preload/index.d'


const DARK_THEMES = [
  { id: 'ocean',  name: 'Ocean',  bg: '#0a1628', accent: '#7ecac3' },
  { id: 'abyss',  name: 'Abyss',  bg: '#06060e', accent: '#7878e0' },
  { id: 'forest', name: 'Forest', bg: '#091409', accent: '#5ec87a' },
  { id: 'ember',  name: 'Ember',  bg: '#140808', accent: '#d87070' },
  { id: 'dusk',   name: 'Dusk',   bg: '#0f0a1e', accent: '#a878d8' },
  { id: 'amber',  name: 'Amber',  bg: '#140e04', accent: '#d89050' },
  { id: 'rose',   name: 'Rose',   bg: '#14080e', accent: '#d878a0' },
]

const LIGHT_THEMES = [
  { id: 'scroll',   name: 'Scroll',   bg: '#f4ede0', accent: '#1e5a48' },
  { id: 'daybreak', name: 'Daybreak', bg: '#eaf1f8', accent: '#104898' },
  { id: 'reef',     name: 'Reef',     bg: '#f0f8f6', accent: '#085848' },
]


export default function SettingsScreen() {
  const { settings, loadSettings, saveSettings, scanMedia, fetchTmdb, isScanning, isFetchingTmdb, tags, addTag, deleteTag } = useStore()

  const [showPaths, setShowPaths] = useState<string[]>([])
  const [moviePaths, setMoviePaths] = useState<string[]>([])
  const [tmdbKey, setTmdbKey] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [tagError, setTagError] = useState('')
  const [orphans, setOrphans] = useState<OrphanEntry[] | null>(null)
  const [orphanChecking, setOrphanChecking] = useState(false)
  const [appVersion, setAppVersion] = useState('')
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloaded' | 'up-to-date' | 'error' | 'dev'>('idle')
  const [updateVersion, setUpdateVersion] = useState('')
  const [selectedTheme, setSelectedTheme] = useState('ocean')
  const [autoBookmark, setAutoBookmark] = useState(true)
  const [autoSubtitle, setAutoSubtitle] = useState(false)
  const [subtitleSize, setSubtitleSize] = useState<'small' | 'medium' | 'large' | 'xl' | 'xxl'>('medium')
  const [subtitleColor, setSubtitleColor] = useState('#ffffff')
  const [subtitleBg, setSubtitleBg] = useState(false)
  const [uiScale, setUiScale] = useState(1.0)

  useEffect(() => { loadSettings() }, [])

  useEffect(() => {
    window.api.getAppVersion().then(setAppVersion)
    window.api.onUpdateAvailable((info) => {
      const i = info as { version?: string }
      setUpdateVersion(i?.version ?? '')
      setUpdateStatus('available')
    })
    window.api.onUpdateNotAvailable(() => setUpdateStatus((s) => s === 'checking' ? 'up-to-date' : s))
    window.api.onUpdateDownloaded(() => setUpdateStatus('downloaded'))
    window.api.onUpdateError(() => setUpdateStatus('error'))
  }, [])

  useEffect(() => {
    setShowPaths(settings.show_paths ?? [])
    setMoviePaths(settings.movie_paths ?? [])
    setTmdbKey(settings.tmdb_api_key ?? '')
    setSelectedTheme(settings.theme ?? 'ocean')
    setAutoBookmark(settings.auto_bookmark !== false)
    setAutoSubtitle(settings.auto_subtitle === true)
    setSubtitleSize(settings.subtitle_size ?? 'medium')
    setSubtitleColor(settings.subtitle_color ?? '#ffffff')
    setSubtitleBg(settings.subtitle_bg ?? false)
    setUiScale(settings.ui_scale ?? 1.0)
  }, [settings])

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

  const handleAddTag = async () => {
    const name = newTagName.trim()
    if (!name) return
    if (tags.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      setTagError('Tag already exists')
      return
    }
    const result = await addTag(name)
    if (result) { setNewTagName(''); setTagError('') }
    else setTagError('Could not create tag')
  }

  const handleCheckUpdates = async () => {
    setUpdateStatus('checking')
    const result = await window.api.checkForUpdates()
    if (result.status === 'dev') setUpdateStatus('dev')
    else if (result.status === 'error') setUpdateStatus('error')
    // Otherwise wait for update-available / update-not-available events
  }

  const customTags = tags.filter((t) => !t.is_default)

  return (
    <>
    <PageWrapper>
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Settings</h1>
          <div className="screen-subtitle">Configure your archive and API access</div>
        </div>
      </div>

      {/* TV Shows Section */}
      <div className="settings-section">
        <div className="settings-section-title">TV Show Folders</div>
        <div className="path-list">
          {showPaths.map((p) => (
            <div className="path-item" key={p}>
              <span className="path-item-text">{p}</span>
              <button className="path-item-remove" onClick={() => removePath('show', p)}>✕</button>
            </div>
          ))}
          {showPaths.length === 0 && (
            <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>No folders configured.</div>
          )}
        </div>
        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => addFolder('show')}>
          + Add Folder
        </button>
      </div>

      {/* Movies Section */}
      <div className="settings-section">
        <div className="settings-section-title">Movie Folders</div>
        <div className="path-list">
          {moviePaths.map((p) => (
            <div className="path-item" key={p}>
              <span className="path-item-text">{p}</span>
              <button className="path-item-remove" onClick={() => removePath('movie', p)}>✕</button>
            </div>
          ))}
          {moviePaths.length === 0 && (
            <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>No folders configured.</div>
          )}
        </div>
        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => addFolder('movie')}>
          + Add Folder
        </button>
      </div>

      {/* TMDB Section */}
      <div className="settings-section">
        <div className="settings-section-title">TMDB API</div>
        <label className="settings-label" htmlFor="tmdb-key">API Key</label>
        <input
          id="tmdb-key"
          className="settings-input"
          type="password"
          placeholder="Enter your TMDB API key…"
          value={tmdbKey}
          onChange={(e) => setTmdbKey(e.target.value)}
          onBlur={(e) => saveSettings({ tmdb_api_key: e.target.value })}
        />
        <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 6 }}>
          Get a free key at themoviedb.org - used to fetch posters and metadata.
        </div>
      </div>

      {/* Custom Tags Section */}
      <div className="settings-section">
        <div className="settings-section-title">Custom Tags</div>
        <div style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 12 }}>
          Add your own tags beyond the defaults. Custom tags can be removed here.
        </div>

        {customTags.length > 0 && (
          <div className="custom-tag-list">
            {customTags.map((tag) => (
              <div key={tag.id} className="custom-tag-item">
                <span className="custom-tag-name" style={{ color: tagColor(tag.id) }}>
                  {tag.name}
                </span>
                <button
                  className="path-item-remove"
                  onClick={() => deleteTag(tag.id)}
                  title="Remove tag"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="custom-tag-add">
          <input
            className="settings-input"
            style={{ flex: 1 }}
            type="text"
            placeholder="New tag name…"
            value={newTagName}
            onChange={(e) => { setNewTagName(e.target.value); setTagError('') }}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
            maxLength={40}
          />
          <button className="btn btn-ghost" onClick={handleAddTag} disabled={!newTagName.trim()}>
            + Add
          </button>
        </div>
        {tagError && <div style={{ color: '#c97b7b', fontSize: 12, marginTop: 6 }}>{tagError}</div>}
      </div>

      {/* Theme Section */}
      <div className="settings-section">
        <div className="settings-section-title">Theme</div>
        <div style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 16 }}>
          Choose an accent color for the interface. Takes effect immediately.
        </div>
        {[{ label: 'Dark', themes: DARK_THEMES }, { label: 'Light', themes: LIGHT_THEMES }].map(({ label, themes }) => (
          <div key={label} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{label}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedTheme(t.id)
                    document.documentElement.setAttribute('data-theme', t.id)
                    saveSettings({ theme: t.id })
                  }}
                  title={t.name}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px',
                  }}
                >
                  <span style={{
                    display: 'block', width: 36, height: 36, borderRadius: '50%',
                    background: `linear-gradient(135deg, ${t.bg} 50%, ${t.accent} 50%)`,
                    border: selectedTheme === t.id
                      ? `3px solid var(--gold)`
                      : '2px solid rgba(128,128,128,0.25)',
                    boxShadow: selectedTheme === t.id ? `0 0 10px ${t.accent}66` : 'none',
                    transition: 'all 0.15s',
                  }} />
                  <span style={{ fontSize: 11, color: selectedTheme === t.id ? 'var(--parchment)' : 'var(--text-dim)' }}>
                    {t.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* UI Scale Section */}
      <div className="settings-section">
        <div className="settings-section-title">Interface Scale</div>
        <div style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 20 }}>
          Drag to resize all UI elements. Takes effect immediately.
        </div>
        <div style={{ padding: '0 4px' }}>
          <input
            type="range"
            className="ui-scale-slider"
            min={0.75}
            max={2.5}
            step={0.05}
            value={uiScale}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              setUiScale(v)
              window.api.setZoom(v)
              saveSettings({ ui_scale: v })
            }}
            style={{
              background: `linear-gradient(to right, var(--teal-light) 0%, var(--teal-light) ${((uiScale - 0.75) / 1.75) * 100}%, rgba(255,255,255,0.15) ${((uiScale - 0.75) / 1.75) * 100}%, rgba(255,255,255,0.15) 100%)`,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, color: 'var(--text-dim)', fontSize: 11 }}>
            <span>75%</span>
            <span>100%</span>
            <span>150%</span>
            <span>200%</span>
            <span>250%</span>
          </div>
          <div style={{ textAlign: 'center', marginTop: 10, color: 'var(--seafoam)', fontSize: 13, fontWeight: 600 }}>
            {Math.round(uiScale * 100)}%
          </div>
        </div>
      </div>

      {/* Playback Section */}
      <div className="settings-section">
        <div className="settings-section-title">Playback</div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: 'var(--text-main)', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={autoBookmark}
              onChange={(e) => { setAutoBookmark(e.target.checked); saveSettings({ auto_bookmark: e.target.checked }) }}
              style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
            />
            Auto-bookmark on exit
          </label>
          <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 4 }}>
            {autoBookmark
              ? 'Your position is saved automatically every 10 seconds and when you leave the player.'
              : 'Position is never saved automatically. Use the 🔖 button in the player to bookmark manually.'}
          </div>
        </div>
      </div>

      {/* Subtitle Appearance Section */}
      <div className="settings-section">
        <div className="settings-section-title">Subtitle Appearance</div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: 'var(--text-main)', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={autoSubtitle}
              onChange={(e) => { setAutoSubtitle(e.target.checked); saveSettings({ auto_subtitle: e.target.checked }) }}
              style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
            />
            Auto-play subtitles
          </label>
          <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 4 }}>
            Automatically activates the first available subtitle track when a video loads.
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="settings-label">Size</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            {([
              { value: 'small',  label: 'Small'  },
              { value: 'medium', label: 'Medium' },
              { value: 'large',  label: 'Large'  },
              { value: 'xl',     label: 'XL'     },
              { value: 'xxl',    label: 'XXL'    },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                className={`btn ${subtitleSize === value ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => { setSubtitleSize(value); saveSettings({ subtitle_size: value }) }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="settings-label">Color</label>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            {([
              { value: '#ffffff', label: 'White' },
              { value: '#ffff00', label: 'Yellow' },
              { value: '#00ffff', label: 'Cyan' },
              { value: '#00ff7f', label: 'Green' },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                title={label}
                onClick={() => { setSubtitleColor(value); saveSettings({ subtitle_color: value }) }}
                style={{
                  width: 32, height: 32,
                  borderRadius: '50%',
                  background: value,
                  border: subtitleColor === value ? '3px solid var(--accent)' : '2px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: 'var(--text-main)', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={subtitleBg}
              onChange={(e) => { setSubtitleBg(e.target.checked); saveSettings({ subtitle_bg: e.target.checked }) }}
              style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
            />
            Background box
          </label>
          <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 4 }}>
            Adds a dark background behind subtitle text for better readability.
          </div>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: '24px 16px', textAlign: 'center' }}>
          <div style={{ color: 'var(--text-dim)', fontSize: 11, marginBottom: 12 }}>Preview</div>
          <span style={{
            fontSize: subtitleSize === 'small' ? 16 : subtitleSize === 'large' ? 30 : subtitleSize === 'xl' ? 42 : subtitleSize === 'xxl' ? 56 : 22,
            color: subtitleColor,
            fontWeight: 500,
            textShadow: '0 1px 4px rgba(0,0,0,1), 0 0 12px rgba(0,0,0,0.9)',
            background: subtitleBg ? 'rgba(0,0,0,0.7)' : 'transparent',
            padding: subtitleBg ? '2px 8px' : undefined,
            borderRadius: subtitleBg ? 4 : undefined,
          }}>
            The sea is calling us forward.
          </span>
        </div>
      </div>

      {/* Library Health Section */}
      <div className="settings-section">
        <div className="settings-section-title">Library Health</div>
        <div style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
          Check for entries whose files can't be found on disk. Only inspects drives that are currently connected -
          entries on disconnected drives are never touched.
          Run a scan first if you just plugged in your drive.

        </div>
        <button
          className="btn btn-ghost"
          disabled={orphanChecking}
          onClick={async () => {
            setOrphanChecking(true)
            try {
              const entries = await window.api.getOfflineEntries()
              setOrphans(entries)
            } finally {
              setOrphanChecking(false)
            }
          }}
        >
          {orphanChecking ? '⟳ Checking…' : '⚠ Clean missing files'}
        </button>
        {orphans !== null && orphans.length === 0 && (
          <div style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 10 }}>
            ✓ No missing files found on connected drives.
          </div>
        )}
      </div>

      {/* Scan / TMDB buttons */}
      <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => scanMedia()} disabled={isScanning || isFetchingTmdb}>
          ⟳ Scan Library
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => fetchTmdb()}
          disabled={isScanning || isFetchingTmdb}
          title="Re-fetch posters and metadata from TMDB for all items"
        >
          🎬 Refresh Metadata
        </button>
      </div>

      {/* Updates Section */}
      <div className="settings-section" style={{ marginTop: 32, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 28 }}>
        <div className="settings-section-title">Updates</div>
        <div style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 16 }}>
          Current version:{' '}
          <strong style={{ color: 'var(--parchment)' }}>v{appVersion}</strong>
        </div>

        {updateStatus === 'available' && (
          <div style={{ color: 'var(--seafoam)', fontSize: 13, marginBottom: 12 }}>
            {updateVersion ? `v${updateVersion}` : 'An update'} is available - downloading…
          </div>
        )}
        {updateStatus === 'downloaded' && (
          <div style={{ color: 'var(--seafoam)', fontSize: 13, marginBottom: 12 }}>
            Update ready{updateVersion ? ` (v${updateVersion})` : ''}. Restart to install.
          </div>
        )}
        {updateStatus === 'up-to-date' && (
          <div style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 12 }}>
            You're on the latest version.
          </div>
        )}
        {updateStatus === 'error' && (
          <div style={{ color: '#c97b7b', fontSize: 13, marginBottom: 12 }}>
            Could not check for updates.
          </div>
        )}
        {updateStatus === 'dev' && (
          <div style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 12 }}>
            Updates are disabled in development mode.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-ghost"
            onClick={handleCheckUpdates}
            disabled={updateStatus === 'checking'}
          >
            {updateStatus === 'checking' ? '⟳ Checking…' : '⟳ Check for Updates'}
          </button>
          {updateStatus === 'downloaded' && (
            <button className="btn btn-primary" onClick={() => window.api.installUpdate()}>
              Restart & Install
            </button>
          )}
        </div>
      </div>

      {/* About / Share Section */}
      <div className="settings-section" style={{ marginTop: 32, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 28 }}>
        <div className="settings-section-title">About</div>
        <div style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
          Archives of Ohara is free, open-source, and built for personal use.
          If you enjoy it, sharing it means a lot.
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            className="btn btn-ghost"
            onClick={() => window.open('https://github.com/davnor10/archives-of-ohara', '_blank')}
          >
            ★ Star on GitHub
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => window.open('https://ko-fi.com/archives_of_ohara', '_blank')}
          >
            ☕ Buy me a coffee
          </button>
        </div>
      </div>
    </PageWrapper>

    {orphans && orphans.length > 0 && (
      <OrphanModal orphans={orphans} onClose={() => setOrphans(null)} />
    )}
    </>
  )
}
