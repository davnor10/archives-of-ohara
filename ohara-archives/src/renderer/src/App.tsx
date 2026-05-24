import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useStore } from './store'
import TitleBar from './components/TitleBar'
import SetSailModal from './components/SetSailModal'
import SeriesScreen from './screens/SeriesScreen'
import MoviesScreen from './screens/MoviesScreen'
import PlayerScreen from './screens/PlayerScreen'
import SettingsScreen from './screens/SettingsScreen'

function AppRoutes() {
  const location = useLocation()
  const [sailOpen, setSailOpen] = useState(false)
  const [sailType, setSailType] = useState<'movie' | 'show'>('show')
  const { loadTags, loadMediaTags, loadSettings, loadBookmarks } = useStore()

  useEffect(() => {
    loadTags()
    loadMediaTags()
    loadSettings()
    loadBookmarks()
  }, [])

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

      <SetSailModal
        open={sailOpen}
        onClose={() => setSailOpen(false)}
        type={sailType}
      />
    </>
  )
}

export default function App() {
  return <AppRoutes />
}
