import { useNavigate } from 'react-router-dom'
import { getCoverUrl, BOOK_STATUS } from '../../lib/bookUtils'

export default function BookCard({ book }) {
  const navigate = useNavigate()
  const coverUrl = getCoverUrl(book.cover_path)
  const status = BOOK_STATUS[book.status]

  return (
    <div
      className="card card-hover cursor-pointer overflow-hidden select-none"
      onClick={() => navigate(`/books/${book.id}`)}
    >
      {/* Cover */}
      <div className="relative overflow-hidden" style={{ aspectRatio: '2/3', backgroundColor: 'var(--bg-tertiary)' }}>
        {coverUrl ? (
          <img src={coverUrl} alt={book.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-5xl" style={{ opacity: 0.2 }}>📖</span>
          </div>
        )}
        {status && (
          <span
            className="absolute bottom-1.5 left-1.5 badge"
            style={{
              backgroundColor: 'rgba(0,0,0,0.65)',
              color: status.color,
              backdropFilter: 'blur(4px)',
              fontSize: '0.6rem',
              padding: '0.1rem 0.4rem',
            }}
          >
            {status.label}
          </span>
        )}
        {book.is_on_loan && (
          <span
            className="absolute top-1.5 right-1.5 badge"
            style={{
              backgroundColor: 'rgba(0,0,0,0.65)',
              color: 'var(--warning)',
              backdropFilter: 'blur(4px)',
              fontSize: '0.6rem',
              padding: '0.1rem 0.4rem',
            }}
          >
            📤 Prestato
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5">
        <h3
          className="font-semibold leading-snug line-clamp-2 mb-0.5"
          style={{ color: 'var(--text-primary)', fontSize: '0.78rem' }}
        >
          {book.title}
        </h3>
        <p className="truncate" style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
          {book.author}
        </p>
        <div className="mt-1.5 flex items-center justify-between gap-1">
          {book.genre ? (
            <span
              className="badge"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--accent) 14%, transparent)',
                color: 'var(--accent)',
                fontSize: '0.6rem',
                maxWidth: '78px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {book.genre}
            </span>
          ) : (
            <span />
          )}
          {book.rating ? (
            <span style={{ color: 'var(--warning)', fontSize: '0.65rem', letterSpacing: '-1px' }}>
              {'★'.repeat(book.rating)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
