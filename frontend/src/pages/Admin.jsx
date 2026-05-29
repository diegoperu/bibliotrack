import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import client from '../api/client'
import useAuthStore from '../stores/authStore'
import { BOOK_STATUS, filterBooks, sortBooks, groupBooks } from '../lib/bookUtils'
import FilterBar, { EMPTY_FILTERS } from '../components/ui/FilterBar'
import SortGroupBar from '../components/ui/SortGroupBar'
import BookGrid from '../components/books/BookGrid'
import BookListItem from '../components/books/BookList'

/* ══════════════════════════════════════════════════
   Shared modal shell
══════════════════════════════════════════════════ */
function ModalShell({ title, onClose, children, maxW = 'max-w-sm' }) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`card w-full ${maxW} p-5`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem' }}
          >✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}

/* ══════════════════════════════════════════════════
   Stats tab
══════════════════════════════════════════════════ */
function AdminStats({ books, users }) {
  const stats = useMemo(() => {
    const byStatus = {}
    const byGenre  = {}
    const byUser   = {}

    for (const b of books) {
      byStatus[b.status] = (byStatus[b.status] || 0) + 1
      if (b.genre) byGenre[b.genre] = (byGenre[b.genre] || 0) + 1
      byUser[b.owner_id] = (byUser[b.owner_id] || 0) + 1
    }

    const topGenres = Object.entries(byGenre).sort(([, a], [, b]) => b - a).slice(0, 10)
    const maxGenre  = topGenres[0]?.[1] || 1

    return { byStatus, topGenres, maxGenre, byUser, total: books.length }
  }, [books])

  const StatCard = ({ icon, label, value, accent }) => (
    <div className="card p-4 flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div>
        <div className="text-xl font-bold" style={{ color: accent || 'var(--text-primary)' }}>{value}</div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard icon="📚" label="Libri totali"  value={stats.total} />
        <StatCard icon="👥" label="Utenti"        value={users.length} />
        <StatCard icon="✅" label="Letti"         value={stats.byStatus.read      || 0} accent="var(--success)" />
        <StatCard icon="📖" label="In lettura"    value={stats.byStatus.reading   || 0} accent="var(--accent)" />
        <StatCard icon="📋" label="Da leggere"    value={stats.byStatus.to_read   || 0} accent="var(--warning)" />
        <StatCard icon="❌" label="Abbandonati"   value={stats.byStatus.abandoned || 0} accent="var(--danger)" />
      </div>

      {/* Genre breakdown */}
      {stats.topGenres.length > 0 && (
        <div className="card p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
            Libri per genere
          </h3>
          <div className="space-y-2">
            {stats.topGenres.map(([genre, count]) => (
              <div key={genre} className="flex items-center gap-3">
                <span className="text-sm w-32 truncate shrink-0" style={{ color: 'var(--text-secondary)' }}>
                  {genre}
                </span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(count / stats.maxGenre) * 100}%`,
                      backgroundColor: 'var(--accent)',
                    }}
                  />
                </div>
                <span className="text-sm font-medium w-6 text-right shrink-0" style={{ color: 'var(--text-primary)' }}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Books per user */}
      {users.length > 0 && (
        <div className="card p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
            Libri per utente
          </h3>
          <div className="space-y-2">
            {users.map((u) => {
              const count = stats.byUser[u.id] || 0
              return (
                <div key={u.id} className="flex items-center gap-3">
                  <span className="text-sm w-28 truncate shrink-0" style={{ color: 'var(--text-secondary)' }}>
                    {u.username}
                  </span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: stats.total ? `${(count / stats.total) * 100}%` : '0%',
                        backgroundColor: 'var(--success)',
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium w-6 text-right shrink-0" style={{ color: 'var(--text-primary)' }}>
                    {count}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════
   Create user modal
══════════════════════════════════════════════════ */
function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'user' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const save = async () => {
    if (!form.username || !form.email || !form.password) return
    setSaving(true); setError('')
    try {
      const { data } = await client.post('/users/', form)
      onCreated(data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Errore creazione utente')
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Nuovo utente" onClose={onClose}>
      <div className="space-y-3">
        {[['username', 'Username', 'text'], ['email', 'Email', 'email'], ['password', 'Password', 'password']].map(
          ([field, label, type]) => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
              <input
                type={type}
                className="input-base"
                value={form[field]}
                onChange={(e) => f(field, e.target.value)}
                autoFocus={field === 'username'}
              />
            </div>
          )
        )}
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Ruolo</label>
          <select className="input-base" value={form.role} onChange={(e) => f('role', e.target.value)}>
            <option value="user">Utente</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

        <div className="flex gap-2 pt-1">
          <button className="btn-secondary" onClick={onClose}>Annulla</button>
          <button
            className="btn-primary flex-1"
            onClick={save}
            disabled={saving || !form.username || !form.email || !form.password}
          >
            {saving ? 'Creando…' : '✓ Crea utente'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

/* ══════════════════════════════════════════════════
   Reset password modal
══════════════════════════════════════════════════ */
function ResetPasswordModal({ user, onClose, onDone }) {
  const [pw, setPw]       = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const save = async () => {
    if (pw !== confirm) { setError('Le password non coincidono'); return }
    if (pw.length < 6)  { setError('Minimo 6 caratteri'); return }
    setSaving(true); setError('')
    try {
      await client.post(`/users/${user.id}/admin-reset-password`, { new_password: pw })
      onDone()
    } catch (e) {
      setError(e.response?.data?.detail || 'Errore reset password')
      setSaving(false)
    }
  }

  return (
    <ModalShell title={`Reset password — ${user.username}`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Nuova password
          </label>
          <input type="password" className="input-base" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Conferma password
          </label>
          <input type="password" className="input-base" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()} />
        </div>

        {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

        <div className="flex gap-2 pt-1">
          <button className="btn-secondary" onClick={onClose}>Annulla</button>
          <button className="btn-primary flex-1" onClick={save} disabled={saving || !pw}>
            {saving ? 'Salvando…' : '🔑 Reimposta'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

/* ══════════════════════════════════════════════════
   Users tab
══════════════════════════════════════════════════ */
function AdminUsers({ users, setUsers, currentUserId }) {
  const [showCreate, setShowCreate]   = useState(false)
  const [resetTarget, setResetTarget] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [working, setWorking] = useState({})
  const [toast, setToast]     = useState('')

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const patchUser = async (userId, payload) => {
    setWorking((p) => ({ ...p, [userId]: true }))
    try {
      const { data } = await client.patch(`/users/${userId}`, payload)
      setUsers((prev) => prev.map((u) => (u.id === userId ? data : u)))
    } catch (e) {
      showToast(e.response?.data?.detail || 'Errore')
    } finally {
      setWorking((p) => ({ ...p, [userId]: false }))
    }
  }

  const deleteUser = async (userId) => {
    setWorking((p) => ({ ...p, [userId]: true }))
    try {
      await client.delete(`/users/${userId}`)
      setUsers((prev) => prev.filter((u) => u.id !== userId))
      setDeleteConfirm(null)
    } catch (e) {
      showToast(e.response?.data?.detail || 'Errore eliminazione')
      setWorking((p) => ({ ...p, [userId]: false }))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {users.length} utenti registrati
        </p>
        <button className="btn-primary text-sm" onClick={() => setShowCreate(true)}>
          ➕ Nuovo utente
        </button>
      </div>

      <div className="space-y-3">
        {users.map((user) => {
          const isSelf    = user.id === currentUserId
          const isWorking = working[user.id]

          return (
            <div key={user.id} className="card p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                      {user.username}
                    </span>
                    <span
                      className="badge text-xs"
                      style={{
                        backgroundColor: user.role === 'admin'
                          ? 'color-mix(in srgb, var(--accent) 18%, transparent)'
                          : 'color-mix(in srgb, var(--text-muted) 15%, transparent)',
                        color: user.role === 'admin' ? 'var(--accent)' : 'var(--text-secondary)',
                      }}
                    >
                      {user.role}
                    </span>
                    {!user.is_active && (
                      <span
                        className="badge text-xs"
                        style={{ backgroundColor: 'color-mix(in srgb, var(--danger) 15%, transparent)', color: 'var(--danger)' }}
                      >
                        disabilitato
                      </span>
                    )}
                    {isSelf && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>(tu)</span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
                  {user.last_login && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Ultimo accesso: {new Date(user.last_login).toLocaleDateString('it-IT')}
                    </p>
                  )}
                </div>

                {!isSelf && (
                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    {/* Toggle active */}
                    <button
                      className="btn-secondary text-xs px-2.5 py-1"
                      onClick={() => patchUser(user.id, { is_active: !user.is_active })}
                      disabled={isWorking}
                      title={user.is_active ? 'Disabilita' : 'Abilita'}
                    >
                      {user.is_active ? '🔒 Disabilita' : '🔓 Abilita'}
                    </button>

                    {/* Toggle role */}
                    <button
                      className="btn-secondary text-xs px-2.5 py-1"
                      onClick={() => patchUser(user.id, { role: user.role === 'admin' ? 'user' : 'admin' })}
                      disabled={isWorking}
                      title="Cambia ruolo"
                    >
                      {user.role === 'admin' ? '→ user' : '→ admin'}
                    </button>

                    {/* Reset password */}
                    <button
                      className="btn-secondary text-xs px-2.5 py-1"
                      onClick={() => setResetTarget(user)}
                      disabled={isWorking}
                    >
                      🔑 Reset pw
                    </button>

                    {/* Delete */}
                    {deleteConfirm === user.id ? (
                      <>
                        <button
                          className="btn-danger text-xs px-2.5 py-1"
                          onClick={() => deleteUser(user.id)}
                          disabled={isWorking}
                        >
                          Conferma
                        </button>
                        <button
                          className="btn-secondary text-xs px-2.5 py-1"
                          onClick={() => setDeleteConfirm(null)}
                        >
                          Annulla
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn-secondary text-xs px-2.5 py-1"
                        onClick={() => setDeleteConfirm(user.id)}
                        disabled={isWorking}
                        style={{ color: 'var(--danger)' }}
                      >
                        🗑️ Elimina
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={(user) => { setUsers((p) => [...p, user]); setShowCreate(false); showToast('Utente creato') }}
        />
      )}
      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onDone={() => { setResetTarget(null); showToast('Password reimpostata') }}
        />
      )}
      {toast && (
        <div
          className="fixed bottom-4 right-4 px-4 py-2 rounded-md text-sm shadow-lg z-50"
          style={{ backgroundColor: 'var(--success)', color: '#fff' }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════
   Books tab (all books + user filter)
══════════════════════════════════════════════════ */
function AdminBooks({ books, users }) {
  const [filters, setFilters]     = useState(EMPTY_FILTERS)
  const [userFilter, setUserFilter] = useState('')
  const [sortBy, setSortBy]       = useState('added_at')
  const [sortOrder, setSortOrder] = useState('desc')
  const [groupBy, setGroupBy]     = useState('')
  const [view, setView]           = useState('list')

  const baseBooks = useMemo(
    () => (userFilter ? books.filter((b) => String(b.owner_id) === userFilter) : books),
    [books, userFilter]
  )
  const filtered = useMemo(() => filterBooks(baseBooks, filters), [baseBooks, filters])
  const sorted   = useMemo(() => sortBooks(filtered, sortBy, sortOrder), [filtered, sortBy, sortOrder])
  const grouped  = useMemo(() => groupBooks(sorted, groupBy), [sorted, groupBy])

  return (
    <div className="space-y-4">
      {/* User selector */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          className="input-base"
          style={{ width: 'auto', minWidth: '180px' }}
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
        >
          <option value="">Tutti gli utenti</option>
          {users.map((u) => (
            <option key={u.id} value={String(u.id)}>
              {u.username} ({books.filter((b) => b.owner_id === u.id).length})
            </option>
          ))}
        </select>
      </div>

      <SortGroupBar
        sortBy={sortBy} sortOrder={sortOrder} groupBy={groupBy} view={view}
        onSortBy={setSortBy} onSortOrder={setSortOrder} onGroupBy={setGroupBy} onView={setView}
        total={baseBooks.length} filtered={sorted.length}
      />

      <FilterBar filters={filters} onChange={setFilters} allBooks={baseBooks} />

      {sorted.length === 0 && (
        <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
          Nessun libro trovato
        </div>
      )}

      {Object.entries(grouped).map(([groupName, grpBooks]) => (
        <div key={groupName}>
          {groupBy && (
            <h3
              className="text-xs font-semibold uppercase tracking-widest mt-5 mb-3 pb-2 border-b"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
            >
              {groupName || '—'} <span className="font-normal normal-case">({grpBooks.length})</span>
            </h3>
          )}
          {view === 'grid' ? (
            <BookGrid books={grpBooks} />
          ) : (
            <div className="space-y-2">
              {grpBooks.map((book) => (
                <BookListItem key={book.id} book={book} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ══════════════════════════════════════════════════
   Admin page (root)
══════════════════════════════════════════════════ */
const TABS = [
  { id: 'stats', label: '📊 Statistiche' },
  { id: 'users', label: '👥 Utenti' },
  { id: 'books', label: '📚 Tutti i libri' },
]

export default function Admin() {
  const { user: currentUser } = useAuthStore()
  const [activeTab, setActiveTab] = useState('stats')
  const [users, setUsers] = useState([])
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([
      client.get('/users/'),
      client.get('/books/', { params: { limit: 200, sort_by: 'added_at', order: 'desc' } }),
    ])
      .then(([uRes, bRes]) => { setUsers(uRes.data); setBooks(bRes.data) })
      .catch((e) => setError(e.response?.data?.detail || 'Errore caricamento'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center animate-pulse" style={{ color: 'var(--text-muted)' }}>
          <div className="text-3xl mb-2">⚙️</div>
          <p>Caricamento…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center" style={{ color: 'var(--danger)' }}>
          <div className="text-3xl mb-2">⚠️</div>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-4">
      {/* Tab bar */}
      <div
        className="flex gap-1 p-1 rounded-lg"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex-1 text-sm font-medium py-2 px-3 rounded-md transition-colors"
            style={{
              backgroundColor: activeTab === id ? 'var(--card-bg)' : 'transparent',
              color: activeTab === id ? 'var(--accent)' : 'var(--text-muted)',
              border: activeTab === id ? '1px solid var(--border)' : '1px solid transparent',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'stats' && <AdminStats books={books} users={users} />}
      {activeTab === 'users' && (
        <AdminUsers users={users} setUsers={setUsers} currentUserId={currentUser?.id} />
      )}
      {activeTab === 'books' && <AdminBooks books={books} users={users} />}
    </div>
  )
}
