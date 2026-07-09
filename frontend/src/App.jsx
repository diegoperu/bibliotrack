import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './stores/authStore'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Library from './pages/Library'
import AddBook from './pages/AddBook'
import BookDetail from './pages/BookDetail'
import Admin from './pages/Admin'
import Loans from './pages/Loans'
import Backup from './pages/Backup'

function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (adminOnly && user?.role !== 'admin') return <Navigate to="/library" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/library" replace />} />
          <Route path="library" element={<Library />} />
          <Route path="books/:id" element={<BookDetail />} />
          <Route path="add-book" element={<AddBook />} />
          <Route path="loans" element={<Loans />} />
          <Route path="backup" element={<Backup />} />
          <Route
            path="admin"
            element={
              <ProtectedRoute adminOnly>
                <Admin />
              </ProtectedRoute>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/library" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
