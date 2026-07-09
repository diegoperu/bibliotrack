import ThemeSwitcher from '../components/ui/ThemeSwitcher'

export default function Settings() {
  return (
    <div className="space-y-4 max-w-md">
      <div className="card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
          Tema
        </h2>
        <ThemeSwitcher />
      </div>

      <div className="card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
          Info
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>BiblioTrack Mobile v0.1.0</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Libreria salvata solo su questo dispositivo. Scanner barcode, export/backup e collegamento
          al server selfhosted arrivano in step futuri.
        </p>
      </div>
    </div>
  )
}
