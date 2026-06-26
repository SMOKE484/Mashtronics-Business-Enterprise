import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import QuoteBuilder from './pages/QuoteBuilder'
import ChatQuestions from './pages/ChatQuestions'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <QuoteBuilder />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat-questions"
        element={
          <ProtectedRoute>
            <ChatQuestions />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
