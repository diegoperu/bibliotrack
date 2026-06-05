import { NavLink, useNavigate } from 'react-router-dom'
import useAuthStore from '../../stores/authStore'
import ThemeSwitcher from '../ui/ThemeSwitcher'

const NAV = [
  { to: '/library',  label: 'Libreria',       icon: '📚' },
  { to: '/add-book', label: 'Aggiungi libro',  icon: '➕' },
  { to: '/loans',    label: 'Prestiti',        icon: '📤' },
]

const ADMIN_NAV = [
  { to: '/admin', label: 'Admin', icon: '⚙️' },
]

export default function Sidebar({ onClose }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside
      className="w-60 shrink-0 flex flex-col"
      style={{ backgroundColor: 'var(--sidebar-bg)', borderRight: '1px solid var(--border)' }}
    >
      {/* Brand */}
      <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <span className="text-xl">📚</span>
          <span className="font-bold text-base" style={{ color: 'var(--sidebar-active)' }}>
            BiblioTrack
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            onClick={onClose}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}

        {user?.role === 'admin' && (
          <>
            <div className="my-2 border-t mx-1" style={{ borderColor: 'var(--border)' }} />
            {ADMIN_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            onClick={onClose}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-3 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
        <div className="px-1">
          <ThemeSwitcher compact />
        </div>

        <div
          className="px-3 py-2 rounded-md"
          style={{ backgroundColor: 'var(--sidebar-hover)' }}
        >
          <div className="text-xs" style={{ color: 'var(--sidebar-text)' }}>
            Connesso come
          </div>
          <div className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
            {user?.username}
          </div>
          {user?.role === 'admin' && (
            <span
              className="badge mt-1"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--sidebar-active) 20%, transparent)',
                color: 'var(--sidebar-active)',
              }}
            >
              Admin
            </span>
          )}
        </div>

        <button className="logout-btn" onClick={handleLogout}>
          <span>🚪</span>
          <span>Esci</span>
        </button>
      </div>
    </aside>
  )
}
