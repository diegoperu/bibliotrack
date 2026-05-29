import { useState } from 'react'

export default function StarRating({ value, onChange, size = '1.4rem' }) {
  const [hover, setHover] = useState(0)
  const active = hover || value || 0

  return (
    <div className="flex gap-0">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star === value ? null : star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          style={{
            color: star <= active ? 'var(--warning)' : 'var(--text-muted)',
            fontSize: size,
            background: 'none',
            border: 'none',
            padding: '0 1px',
            cursor: 'pointer',
            lineHeight: 1,
            transition: 'color 0.1s',
          }}
        >
          ★
        </button>
      ))}
    </div>
  )
}
