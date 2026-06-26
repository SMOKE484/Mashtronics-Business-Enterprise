import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logo from '../assets/logo.png'
import './Login.css'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Login failed')
        return
      }
      navigate('/')
    } catch {
      setError('Could not reach server. Is it running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <header className="login-header">
        <img src={logo} alt="Mashtronics" className="login-header__logo" />
        <span className="login-header__title">ADMIN</span>
      </header>

      <div className="login-body">
        <div className="login-card">
          <h1 className="login-card__heading">Sign in</h1>
          <p className="login-card__sub">Staff access only</p>

          {error && (
            <div className="login-error">
              <i className="fas fa-exclamation-circle" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary login-submit"
              disabled={loading}
            >
              {loading
                ? <><i className="fas fa-spinner fa-spin" /> Signing in…</>
                : <><i className="fas fa-sign-in-alt" /> Sign in</>
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
