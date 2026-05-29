import { useNavigate } from 'react-router-dom'
import AddBookModal from '../components/books/AddBookModal'

export default function AddBook() {
  const navigate = useNavigate()
  return (
    <AddBookModal
      onClose={() => navigate('/library')}
      onSaved={(book) => navigate(`/books/${book.id}`)}
    />
  )
}
