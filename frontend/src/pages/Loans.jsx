import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import { getCoverUrl } from '../lib/bookUtils'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
}

function daysAgoLabel(days) {
  if (days === 0) return 'oggi'
  if (days === 1) return '1 giorno fa'
  return `${days} giorni fa`
}

/* ── Active loan card ──────────────────────────────────────────────── */
function ActiveLoanCard({ loan, onReturned }) {
  const navigate = useNavigate()
  const [returning, setReturning] = useState(false)
  const coverUrl = getCoverUrl(loan.book_cover_path)

  const handleReturn = async (e) => {
    e.stopPropagation()
    setReturning(true)
    try {
      await client.put(`/loans/${loan.id}/return`)
      onReturned()
    } catch {
      setReturning(false)
    }
  }

  return (
    <div
      className="card flex gap-3 p-3 cursor-pointer card-hover"
      onClick={() => navigate(`/books/${loan.book_id}`)}
    >
      <div
        className="shrink-0 rounded overflow-hidden"
        style={{ width: '44px', aspectRatio: '2/3', backgroundColor: 'var(--bg-tertiary)' }}
      >
        {coverUrl ? (
          <img src={coverUrl} alt={loan.book_title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ opacity: 0.3 }}>📖</div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
          {loan.book_title}
        </h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          📤 {loan.borrower_display_name}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Dal {formatDate(loan.loaned_at)} · {daysAgoLabel(loan.duration_days)}
        </p>
        {loan.notes && (
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
            {loan.notes}
          </p>
        )}
      </div>

      <button
        className="btn-secondary text-xs shrink-0 self-center px-2 py-1"
        onClick={handleReturn}
        disabled={returning}
        style={{ minWidth: '80px' }}
      >
        {returning ? '…' : '✓ Restituito'}
      </button>
    </div>
  )
}

/* ── Borrower accordion row ────────────────────────────────────────── */
function BorrowerRow({ borrower }) {
  const [expanded, setExpanded] = useState(false)
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const toggle = async () => {
    if (!expanded && !detail) {
      setLoading(true)
      try {
        const { data } = await client.get(`/loans/borrowers/${borrower.id}`)
        setDetail(data)
      } finally {
        setLoading(false)
      }
    }
    setExpanded((v) => !v)
  }

  return (
    <div className="card overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={toggle}
        style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        <div>
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            {borrower.display_name}
          </span>
          <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
            {borrower.active_loan_count > 0 && (
              <span style={{ color: 'var(--warning)' }}>{borrower.active_loan_count} attivi</span>
            )}
            {borrower.active_loan_count > 0 && borrower.loan_count > borrower.active_loan_count && ' · '}
            {borrower.loan_count > borrower.active_loan_count && `${borrower.loan_count} totali`}
          </span>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded && (
        <div className="border-t" style={{ borderColor: 'var(--border)' }}>
          {loading && (
            <p className="text-xs px-4 py-3" style={{ color: 'var(--text-muted)' }}>Caricamento…</p>
          )}
          {detail && detail.loans.map((loan) => (
            <div
              key={loan.id}
              className="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 cursor-pointer"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: loan.is_active ? 'color-mix(in srgb, var(--warning) 5%, transparent)' : 'transparent',
              }}
              onClick={() => navigate(`/books/${loan.book_id}`)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate" style={{ color: 'var(--text-primary)', fontWeight: loan.is_active ? 600 : 400 }}>
                  {loan.book_title}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {formatDate(loan.loaned_at)}
                  {loan.returned_at ? ` → ${formatDate(loan.returned_at)} (${loan.duration_days}gg)` : ` · In corso (${loan.duration_days}gg)`}
                </p>
              </div>
              {loan.is_active && (
                <span
                  className="badge shrink-0 text-xs"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--warning) 20%, transparent)',
                    color: 'var(--warning)',
                  }}
                >
                  Attivo
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Loans page ────────────────────────────────────────────────────── */
export default function Loans() {
  const [tab, setTab] = useState('active')
  const [activeLoans, setActiveLoans] = useState([])
  const [borrowers, setBorrowers] = useState([])
  const [loadingActive, setLoadingActive] = useState(true)
  const [loadingBorrowers, setLoadingBorrowers] = useState(true)
  const [error, setError] = useState(null)

  const fetchActive = useCallback(() => {
    setLoadingActive(true)
    client
      .get('/loans/active')
      .then(({ data }) => setActiveLoans(data))
      .catch((e) => setError(e.response?.data?.detail || 'Errore'))
      .finally(() => setLoadingActive(false))
  }, [])

  const fetchBorrowers = useCallback(() => {
    setLoadingBorrowers(true)
    client
      .get('/loans/borrowers')
      .then(({ data }) => {
        const sorted = [...data].sort((a, b) => (b.active_loan_count - a.active_loan_count) || a.display_name.localeCompare(b.display_name, 'it'))
        setBorrowers(sorted)
      })
      .catch(() => {})
      .finally(() => setLoadingBorrowers(false))
  }, [])

  useEffect(() => {
    fetchActive()
  }, [fetchActive])

  useEffect(() => {
    if (tab === 'people') fetchBorrowers()
  }, [tab, fetchBorrowers])

  const handleReturned = () => {
    fetchActive()
  }

  const TAB = [
    { id: 'active', label: 'Attivi' },
    { id: 'people', label: 'Per persona' },
  ]

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Prestiti</h1>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        {TAB.map((t) => (
          <button
            key={t.id}
            className="flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors"
            style={{
              backgroundColor: tab === t.id ? 'var(--bg-primary)' : 'transparent',
              color: tab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
              border: 'none',
              cursor: 'pointer',
            }}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
      )}

      {/* Active tab */}
      {tab === 'active' && (
        <div className="space-y-2">
          {loadingActive ? (
            <div className="text-center py-12 animate-pulse" style={{ color: 'var(--text-muted)' }}>
              Caricamento…
            </div>
          ) : activeLoans.length === 0 ? (
            <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
              <div className="text-4xl mb-3">📚</div>
              <p>Nessun prestito attivo.</p>
            </div>
          ) : (
            <>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {activeLoans.length} {activeLoans.length === 1 ? 'libro in prestito' : 'libri in prestito'} · ordinati dal più vecchio
              </p>
              {activeLoans.map((loan) => (
                <ActiveLoanCard key={loan.id} loan={loan} onReturned={handleReturned} />
              ))}
            </>
          )}
        </div>
      )}

      {/* Per persona tab */}
      {tab === 'people' && (
        <div className="space-y-2">
          {loadingBorrowers ? (
            <div className="text-center py-12 animate-pulse" style={{ color: 'var(--text-muted)' }}>
              Caricamento…
            </div>
          ) : borrowers.length === 0 ? (
            <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
              <div className="text-4xl mb-3">👤</div>
              <p>Nessuna persona ancora.</p>
            </div>
          ) : (
            borrowers.map((b) => (
              <BorrowerRow key={b.id} borrower={b} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
