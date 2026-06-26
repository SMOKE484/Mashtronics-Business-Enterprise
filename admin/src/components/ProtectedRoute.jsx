import { useState, useEffect, createContext, useContext } from 'react'
import { Navigate } from 'react-router-dom'

const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

export default function ProtectedRoute({ children }) {
  const [state, setState] = useState('loading') // 'loading' | 'authed' | 'unauthed'
  const [user, setUser] = useState(null)

  useEffect(() => {
    setUser({ username: 'admin' })
    setState('authed')
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    setState('unauthed')
    setUser(null)
  }

  if (state === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--primary)' }} />
      </div>
    )
  }

  if (state === 'unauthed') {
    return <Navigate to="/login" replace />
  }

  return (
    <AuthContext.Provider value={{ user, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
