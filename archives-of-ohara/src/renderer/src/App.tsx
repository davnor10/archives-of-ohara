import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useStore } from './store'
import TitleBar from './components/TitleBar'
import LoadingOverlay from './components/LoadingOverlay'
import SetSailModal from './components/SetSailModal'
import UpdateModal from './components/UpdateModal'
import SeriesScreen from './screens/SeriesScreen'
import MoviesScreen from './screens/MoviesScreen'
import PlayerScreen from './screens/PlayerScreen'
import SettingsScreen from './screens/SettingsScreen'

function AppRoutes() {
  const location = useLocation()
  const [sailOpen, setSailOpen] = useState(false)
  const [sailType, setSailType] = useState<'movie' | 'show'>('show')
  const [updateInfo, setUpdateInfo] = useState<{ version: string; ready: boolean } | null>(null)
  const { loadTags, loadMediaTags, loadSettings, loadBookmarks, scanMedia, settings } = useStore()

  useEffect(() => {
    loadTags()
    loadMediaTags()
    loadSettings()
    loadBookmarks()
    scanMedia()
  }, [])

  useEffect(() => {
    window.api.onUpdateAvailable((info) => {
      const v = (info as { version?: string })?.version ?? ''
      setUpdateInfo({ version: v, ready: false })
    })
    window.api.onUpdateDownloaded(() => {
      setUpdateInfo((prev) => prev ? { ...prev, ready: true } : { version: '', ready: true })
    })
    window.api.checkForUpdates()
  }, [])

  useEffect(() => {
    window.api.setZoom(settings.ui_scale ?? 1.0)
  }, [settings.ui_scale])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme ?? 'ocean')
  }, [settings.theme])

  const handleSetSail = () => {
    // Pick type based on current route
    const isMovies = location.pathname === '/movies'
    setSailType(isMovies ? 'movie' : 'show')
    setSailOpen(true)
  }

  return (
    <>
      <div className="nautical-bg" />

      <div className="app-shell">
        <TitleBar onSetSail={handleSetSail} />

        <div className="page-content">
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Navigate to="/series" replace />} />
              <Route path="/series" element={<SeriesScreen />} />
              <Route path="/movies" element={<MoviesScreen />} />
              <Route path="/player" element={<PlayerScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
            </Routes>
          </AnimatePresence>
        </div>
      </div>

      <LoadingOverlay />

      <SetSailModal
        open={sailOpen}
        onClose={() => setSailOpen(false)}
        type={sailType}
      />

      {updateInfo && (
        <UpdateModal
          version={updateInfo.version}
          ready={updateInfo.ready}
          onInstall={() => window.api.installUpdate()}
          onIgnore={() => setUpdateInfo(null)}
        />
      )}

    </>
  )
}

export default function App() {
  return <AppRoutes />
}
