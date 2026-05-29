import { useLocation } from 'react-router-dom'

const TITLES = {
  '/library':   'Libreria',
  '/add-book':  'Aggiungi libro',
  '/admin':     'Pannello Admin',
  '/books':     'Dettaglio libro',
}

export default function Header({ onMenuClick }) {
  const { pathname } = useLocation()
  const title =
    Object.entries(TITLES).find(([path]) => pathname.startsWith(path))?.[1] ?? 'BiblioTrack'

  return (
    <header
      className="px-4 py-3 shrink-0 border-b flex items-center gap-3"
      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)' }}
    >
      {/* Hamburger — mobile only */}
      <button
        className="md:hidden p-1.5 rounded"
        onClick={onMenuClick}
        style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}
        aria-label="Menu"
      >
        ☰
      </button>

      <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h1>
    </header>
  )
}
