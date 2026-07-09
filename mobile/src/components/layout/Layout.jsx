import { Outlet, Link, useLocation } from 'react-router-dom'

export default function Layout() {
  const location = useLocation()

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
      >
        <Link to="/library" className="font-bold text-lg" style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>
          📚 BiblioTrack
        </Link>
        <Link
          to="/settings"
          aria-label="Impostazioni"
          style={{
            color: location.pathname === '/settings' ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: '1.25rem',
            textDecoration: 'none',
          }}
        >
          ⚙️
        </Link>
      </header>

      <main className="p-4 max-w-5xl mx-auto">
        <Outlet />
      </main>
    </div>
  )
}
