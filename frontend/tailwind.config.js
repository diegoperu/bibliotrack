/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary:        'var(--bg-primary)',
        secondary:      'var(--bg-secondary)',
        tertiary:       'var(--bg-tertiary)',
        accent:         'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'text-main':    'var(--text-primary)',
        'text-sub':     'var(--text-secondary)',
        'text-muted':   'var(--text-muted)',
        'border-main':  'var(--border)',
        sidebar:        'var(--sidebar-bg)',
      },
    },
  },
  plugins: [],
}
