import useThemeStore, { THEMES } from '../../stores/themeStore'

const META = {
  'light':            { label: 'Light',  icon: '☀️' },
  'dark':             { label: 'Dark',   icon: '🌙' },
  'catppuccin-light': { label: 'Latte',  icon: '☕' },
  'catppuccin-dark':  { label: 'Mocha',  icon: '🌸' },
}

export default function ThemeSwitcher({ compact = false }) {
  const { theme, setTheme } = useThemeStore()

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {THEMES.map((t) => {
        const active = theme === t
        return (
          <button
            key={t}
            onClick={() => setTheme(t)}
            title={META[t].label}
            style={{
              backgroundColor: active
                ? 'color-mix(in srgb, var(--sidebar-active) 20%, transparent)'
                : 'transparent',
              border: active
                ? '1px solid var(--sidebar-active)'
                : '1px solid var(--border)',
              color: active ? 'var(--sidebar-active)' : 'var(--sidebar-text)',
              padding: compact ? '0.2rem 0.35rem' : '0.25rem 0.6rem',
              borderRadius: '0.375rem',
              fontSize: compact ? '0.8rem' : '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <span>{META[t].icon}</span>
            {!compact && <span>{META[t].label}</span>}
          </button>
        )
      })}
    </div>
  )
}
