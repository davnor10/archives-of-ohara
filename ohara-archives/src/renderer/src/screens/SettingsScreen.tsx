import { useEffect, useState } from 'react'
import { useStore } from '../store'
import PageWrapper from '../components/PageWrapper'
import { tagColor } from '../components/TagPicker'

export default function SettingsScreen() {
  const { settings, loadSettings, saveSettings, scanMedia, fetchTmdb, isScanning, isFetchingTmdb, tags, addTag, deleteTag } = useStore()

  const [showPaths, setShowPaths] = useState<string[]>([])
  const [moviePaths, setMoviePaths] = useState<string[]>([])
  const [tmdbKey, setTmdbKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [tagError, setTagError] = useState('')
  const [subtitleSize, setSubtitleSize] = useState<'small' | 'medium' | 'large'>('medium')
  const [subtitleColor, setSubtitleColor] = useState('#ffffff')
  const [subtitleBg, setSubtitleBg] = useState(false)

  useEffect(() => { loadSettings() }, [])

  useEffect(() => {
    setShowPaths(settings.show_paths ?? [])
    setMoviePaths(settings.movie_paths ?? [])
    setTmdbKey(settings.tmdb_api_key ?? '')
    setSubtitleSize(settings.subtitle_size ?? 'medium')
    setSubtitleColor(settings.subtitle_color ?? '#ffffff')
    setSubtitleBg(settings.subtitle_bg ?? false)
  }, [settings])

  const addFolder = async (type: 'show' | 'movie') => {
    const folder = await window.api.selectFolder()
    if (!folder) return
    if (type === 'show') setShowPaths((p) => [...new Set([...p, folder])])
    else setMoviePaths((p) => [...new Set([...p, folder])])
  }

  const removePath = (type: 'show' | 'movie', path: string) => {
    if (type === 'show') setShowPaths((p) => p.filter((x) => x !== path))
    else setMoviePaths((p) => p.filter((x) => x !== path))
  }

  const handleSave = async () => {
    await saveSettings({ show_paths: showPaths, movie_paths: moviePaths, tmdb_api_key: tmdbKey, subtitle_size: subtitleSize, subtitle_color: subtitleColor, subtitle_bg: subtitleBg })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleScanAndSave = async () => {
    await handleSave()
    await scanMedia()
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

  const customTags = tags.filter((t) => !t.is_default)

  return (
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
        />
        <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 6 }}>
          Get a free key at themoviedb.org — used to fetch posters and metadata.
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

      {/* Subtitle Appearance Section */}
      <div className="settings-section">
        <div className="settings-section-title">Subtitle Appearance</div>

        <div style={{ marginBottom: 16 }}>
          <label className="settings-label">Size</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            {(['small', 'medium', 'large'] as const).map((s) => (
              <button
                key={s}
                className={`btn ${subtitleSize === s ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setSubtitleSize(s)}
                style={{ textTransform: 'capitalize' }}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
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
                onClick={() => setSubtitleColor(value)}
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
              onChange={(e) => setSubtitleBg(e.target.checked)}
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
            fontSize: subtitleSize === 'small' ? 16 : subtitleSize === 'large' ? 30 : 22,
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

      {/* Save / Scan / TMDB buttons */}
      <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? '✓ Saved' : 'Save Settings'}
        </button>
        <button className="btn btn-ghost" onClick={handleScanAndSave} disabled={isScanning || isFetchingTmdb}>
          {isScanning ? <><span className="spinner" /> Scanning…</> : '⟳ Save & Scan Library'}
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => fetchTmdb()}
          disabled={isScanning || isFetchingTmdb}
          title="Re-fetch posters and metadata from TMDB for all items"
        >
          {isFetchingTmdb ? <><span className="spinner" /> Fetching Metadata…</> : '🎬 Refresh Metadata'}
        </button>
      </div>
    </PageWrapper>
  )
}
