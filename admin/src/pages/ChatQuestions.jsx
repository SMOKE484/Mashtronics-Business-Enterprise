import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/ProtectedRoute'
import logo from '../assets/logo.png'
import './ChatQuestions.css'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ChatQuestions() {
  const { user, logout } = useAuth()
  const [questions, setQuestions] = useState([])
  const [stats, setStats] = useState({ total: 0, uniqueCount: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/chat/questions', { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error('Failed to load')
        return r.json()
      })
      .then(data => {
        setQuestions(data.questions ?? [])
        setStats(data.stats ?? { total: 0, uniqueCount: 0 })
      })
      .catch(() => setError('Could not load chat questions. Make sure the server is running.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="cq-page">
      <header className="qb-header">
        <div className="qb-header__brand">
          <img src={logo} alt="Mashtronics" className="qb-header__logo" />
          ADMIN
        </div>
        <nav className="qb-header__nav">
          <Link to="/" className="qb-nav-link"><i className="fas fa-file-invoice-dollar" /> Quote Builder</Link>
          <span className="qb-nav-link qb-nav-link--active"><i className="fas fa-comments" /> Chat Questions</span>
        </nav>
        <div className="qb-header__right">
          {user && <span className="qb-header__user"><i className="fas fa-user-circle" /> {user.username}</span>}
          <button
            className="btn btn-ghost"
            style={{ padding: '0.4rem 0.9rem', color: 'white', borderColor: 'rgba(255,255,255,0.4)' }}
            onClick={logout}
          >
            <i className="fas fa-sign-out-alt" /> Logout
          </button>
        </div>
      </header>

      <div className="cq-body">
        <h1 className="cq-title"><i className="fas fa-chart-bar" /> Chat FAQ Analysis</h1>

        <div className="cq-stats">
          <div className="cq-stat-card">
            <div className="cq-stat-value">{stats.total.toLocaleString()}</div>
            <div className="cq-stat-label">Total messages logged</div>
          </div>
          <div className="cq-stat-card">
            <div className="cq-stat-value">{stats.uniqueCount?.toLocaleString() ?? 0}</div>
            <div className="cq-stat-label">Unique questions</div>
          </div>
        </div>

        {loading && (
          <div className="cq-loading">
            <i className="fas fa-spinner fa-spin" /> Loading…
          </div>
        )}

        {error && <div className="cq-error"><i className="fas fa-exclamation-triangle" /> {error}</div>}

        {!loading && !error && questions.length === 0 && (
          <div className="cq-empty">
            <i className="fas fa-comment-slash" />
            <p>No questions logged yet. Once visitors use the chatbot, their questions will appear here.</p>
          </div>
        )}

        {!loading && !error && questions.length > 0 && (
          <div className="qb-card">
            <div className="qb-section-title"><i className="fas fa-list-ol" /> Top Questions</div>
            <table className="cq-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Question</th>
                  <th>Times asked</th>
                  <th>Last asked</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q, i) => (
                  <tr key={i}>
                    <td className="cq-rank">{i + 1}</td>
                    <td className="cq-question">{q.question}</td>
                    <td className="cq-count">
                      <span className="cq-badge">{q.count}</span>
                    </td>
                    <td className="cq-date">{formatDate(q.lastAsked)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
