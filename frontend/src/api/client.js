import axios from 'axios'
import useAuthStore from '../stores/authStore'

const API_BASE = import.meta.env.VITE_API_URL || ''

const client = axios.create({ baseURL: API_BASE })

client.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState()
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

let isRefreshing = false
let failedQueue = []

const flushQueue = (err, token = null) => {
  failedQueue.forEach((p) => (err ? p.reject(err) : p.resolve(token)))
  failedQueue = []
}

client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const orig = err.config
    if (err.response?.status !== 401 || orig._retry) return Promise.reject(err)

    if (isRefreshing) {
      return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
        .then((token) => {
          orig.headers.Authorization = `Bearer ${token}`
          return client(orig)
        })
        .catch(Promise.reject.bind(Promise))
    }

    orig._retry = true
    isRefreshing = true

    const { refreshToken, logout, updateAccessToken } = useAuthStore.getState()
    if (!refreshToken) { logout(); return Promise.reject(err) }

    try {
      // Token sent in request body (not URL params) to avoid leaking in server logs
      const { data } = await axios.post(`${API_BASE}/auth/refresh`, { token: refreshToken })
      updateAccessToken(data.access_token)
      flushQueue(null, data.access_token)
      orig.headers.Authorization = `Bearer ${data.access_token}`
      return client(orig)
    } catch (refreshErr) {
      flushQueue(refreshErr)
      logout()
      return Promise.reject(refreshErr)
    } finally {
      isRefreshing = false
    }
  }
)

export default client
