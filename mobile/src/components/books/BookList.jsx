import { useNavigate } from 'react-router-dom'
import { getCoverUrl, BOOK_STATUS } from '../../lib/bookUtils'

export default function BookListItem({ book }) {
  const navigate = useNavigate()
  const coverUrl = getCoverUrl(book.cover_path)
  const status = BOOK_STATUS[book.status]

  return (
    <div
      className="card card-hover flex gap-3 p-3 cursor-pointer"
      onClick={() => navigate(`/books/${book.id}`)}
    >
      {/* Thumbnail */}
      <div
        className="shrink-0 rounded overflow-hidden"
        style={{ width: '44px', aspectRatio: '2/3', backgroundColor: 'var(--bg-tertiary)' }}
      >
        {coverUrl ? (
          <img src={coverUrl} alt={book.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ opacity: 0.3 }}>📖</div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
            {book.title}
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            {book.is_on_loan && (
              <span
                className="badge"
                style={{
                  color: 'var(--warning)',
                  backgroundColor: 'color-mix(in srgb, var(--warning) 12%, transparent)',
                  fontSize: '0.65rem',
                }}
              >
                📤 Prestato
              </span>
            )}
            {status && (
              <span
                className="badge"
                style={{
                  color: status.color,
                  backgroundColor: 'color-mix(in srgb,' + status.color + ' 12%, transparent)',
                  fontSize: '0.65rem',
                }}
              >
                {status.label}
              </span>
            )}
          </div>
        </div>

        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {book.author}
        </p>

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {book.genre && (
            <span
              className="badge"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                color: 'var(--accent)',
                fontSize: '0.65rem',
              }}
            >
              {book.genre}
            </span>
          )}
          {book.publisher && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{book.publisher}</span>
          )}
          {book.year && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{book.year}</span>
          )}
          {book.rating && (
            <span style={{ color: 'var(--warning)', fontSize: '0.7rem' }}>
              {'★'.repeat(book.rating)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
