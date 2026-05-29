import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import useAuthStore from '../stores/authStore'
import ThemeSwitcher from '../components/ui/ThemeSwitcher'

export default function Login() {
  const navigate = useNavigate()
  const { login, isAuthenticated } = useAuthStore()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isAuthenticated) navigate('/library', { replace: true })
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('username', form.username)
      params.append('password', form.password)

      const { data: tokens } = await client.post('/auth/login', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })

      const { data: user } = await client.get('/auth/me', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })

      login(user, tokens.access_token, tokens.refresh_token)
      navigate('/library', { replace: true })
    } catch (err) {
      const detail = err.response?.data?.detail
      if (Array.isArray(detail)) setError(detail.map((d) => d.msg).join(', '))
      else setError(detail || 'Credenziali non valide')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--bg-secondary)' }}
    >
      <div className="absolute top-4 right-4">
        <ThemeSwitcher />
      </div>

      <div className="card w-full max-w-sm p-8">
        {/* Logo */}
        <div className="text-center mb-7">
          <div className="text-5xl mb-2">📚</div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            BiblioTrack
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            La tua biblioteca personale
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Username
            </label>
            <input
              type="text"
              className="input-base"
              placeholder="Il tuo username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              autoFocus
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Password
            </label>
            <input
              type="password"
              className="input-base"
              placeholder="La tua password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div
              className="text-sm p-3 rounded-md"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--danger) 12%, transparent)',
                color: 'var(--danger)',
                border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
              }}
            >
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Accesso in corso…' : 'Accedi'}
          </button>
        </form>
      </div>
    </div>
  )
}
