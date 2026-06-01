import { NavLink, useLocation } from 'react-router-dom'
import { useStore } from '../store'
import CloverLogo from './CloverLogo'

interface Props {
  onSetSail: () => void
}

export default function TitleBar({ onSetSail }: Props) {
  const { isScanning, scanMedia } = useStore()
  const location = useLocation()
  const isPlayer = location.pathname === '/player'

  if (isPlayer) return null

  return (
    <header className="title-bar">
      <div className="title-bar-logo">
        <CloverLogo size={28} color="#c9a84c" />
        <span className="title-bar-logo-text">Archives of Ohara</span>
      </div>

      <nav className="title-bar-nav">
        <NavLink
          to="/shows"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          Shows
        </NavLink>
        <NavLink
          to="/movies"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          Movies
        </NavLink>
      </nav>

      <div className="title-bar-spacer" />

      <div className="title-bar-actions">
        <button className="btn-sail" onClick={onSetSail}>
          🎲 Set Sail
        </button>

        <button className="btn-scan" onClick={scanMedia} disabled={isScanning}>
          ⟳ Scan
        </button>

        <NavLink
          to="/settings"
          className={({ isActive }) => `btn-scan${isActive ? ' active' : ''}`}
          style={{ textDecoration: 'none' }}
        >
          ⚙
        </NavLink>
      </div>

      <div className="window-controls">
        <button className="wc-btn wc-close" onClick={() => window.api.closeWindow()} />
        <button className="wc-btn wc-min" onClick={() => window.api.minimizeWindow()} />
        <button className="wc-btn wc-max" onClick={() => window.api.maximizeWindow()} />
      </div>
    </header>
  )
}
