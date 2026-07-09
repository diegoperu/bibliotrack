import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Library from './pages/Library'
import BookDetail from './pages/BookDetail'
import Settings from './pages/Settings'

// HashRouter, not BrowserRouter: Capacitor serves the app from a local
// capacitor://localhost / file:// origin where History API deep-links
// don't survive a webview reload the way they do on a real web server.
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/library" replace />} />
          <Route path="library" element={<Library />} />
          <Route path="books/:id" element={<BookDetail />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/library" replace />} />
      </Routes>
    </HashRouter>
  )
}
