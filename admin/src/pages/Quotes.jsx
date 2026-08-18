import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ZAR } from '../api'
import { LoadingState, LoadErrorState, EmptyState, ActionErrorBanner, ConfirmDialog } from '../components/PageState'

const STATUS_BADGE = { draft: 'badge--neutral', sent: 'badge--info', follow_up_due: 'badge--warning', won: 'badge--success', lost: 'badge--danger' }
const STATUS_LABEL = { draft: 'Draft', sent: 'Sent', follow_up_due: 'Follow-up Due', won: 'Won', lost: 'Lost' }
const STATUSES = ['draft', 'sent', 'follow_up_due', 'won', 'lost']

function scopeOf(q) {
  if (q.scopeOfWork) return q.scopeOfWork
  if (q.items?.[0]?.description) return q.items[0].description
  if (q.sections?.[0]?.items?.[0]?.description) return q.sections[0].items[0].description
  return '—'
}

export default function Quotes() {
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [confirmQuote, setConfirmQuote] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const navigate = useNavigate()

  function load() {
    if (!quotes.length) setLoading(true)
    setLoadError('')
    api.get('/quotes').then(setQuotes).catch(err => setLoadError(err.message)).finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function setStatus(q, status) {
    setActionError('')
    try {
      await api.patch(`/quotes/${q._id}/status`, { status })
    } catch (err) {
      setActionError(`Couldn't update the status of ${q.quoteNumber || 'this quote'} — ${err.message}. Please try again.`)
    }
    load() // refresh on failure too, so the dropdown snaps back to what's actually saved
  }

  async function setFollowUp(q, followUpDate) {
    setActionError('')
    try {
      await api.patch(`/quotes/${q._id}/status`, { status: q.status, followUpDate })
    } catch (err) {
      setActionError(`Couldn't set the follow-up date for ${q.quoteNumber || 'this quote'} — ${err.message}. Please try again.`)
    }
    load()
  }

  async function deleteQuote() {
    setDeleting(true)
    setDeleteError('')
    try {
      await api.delete(`/quotes/${confirmQuote._id}`)
      setConfirmQuote(null)
      load()
    } catch (err) {
      setDeleteError(`Couldn't delete ${confirmQuote.quoteNumber || 'this quote'} — ${err.message}. Please try again.`)
    } finally {
      setDeleting(false)
    }
  }

  const wonCount = quotes.filter(q => q.status === 'won').length

  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">Quote Pipeline</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {quotes.length > 0 && <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>{wonCount} of {quotes.length} quotes won</div>}
          <button className="btn btn-primary" onClick={() => navigate('/quotes/new')}><i className="fas fa-plus" /> New Quote</button>
        </div>
      </div>

      <ActionErrorBanner onDismiss={() => setActionError('')}>{actionError}</ActionErrorBanner>

      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <LoadErrorState onRetry={load}>Couldn't load the quote pipeline — {loadError}.</LoadErrorState>
      ) : quotes.length === 0 ? (
        <EmptyState actionLabel="New Quote" onAction={() => navigate('/quotes/new')}>
          No quotes yet. Create your first quote to start tracking the pipeline.
        </EmptyState>
      ) : (
        <table className="data-table">
          <thead>
            <tr><th>Client</th><th>Scope</th><th>Value</th><th>Sent</th><th>Follow-up</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {quotes.map(q => (
              <tr key={q._id} className="clickable" onClick={() => navigate(`/quotes/${q._id}/edit`)}>
                <td className="strong">{q.clientRef?.name || q.customerName}</td>
                <td>{scopeOf(q)}</td>
                <td>{ZAR(q.total)}</td>
                <td>{q.sentDate ? new Date(q.sentDate).toLocaleDateString('en-ZA') : '—'}</td>
                <td onClick={e => e.stopPropagation()}>
                  <input
                    type="date"
                    value={q.followUpDate ? q.followUpDate.slice(0, 10) : ''}
                    onChange={e => setFollowUp(q, e.target.value)}
                    style={{ fontSize: '0.78rem', padding: '0.3rem 0.4rem' }}
                  />
                </td>
                <td onClick={e => e.stopPropagation()}>
                  <select
                    className={`badge ${STATUS_BADGE[q.status]}`}
                    style={{ border: 'none', cursor: 'pointer' }}
                    value={q.status}
                    onChange={e => setStatus(q, e.target.value)}
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </td>
                <td onClick={e => e.stopPropagation()}>
                  <button className="btn btn-ghost" onClick={() => { setDeleteError(''); setConfirmQuote(q) }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {confirmQuote && (
        <ConfirmDialog
          title="Delete quote"
          message={`Delete quote ${confirmQuote.quoteNumber || ''} for ${confirmQuote.clientRef?.name || confirmQuote.customerName}? This can't be undone.`}
          confirmLabel="Delete"
          busy={deleting}
          error={deleteError}
          onConfirm={deleteQuote}
          onCancel={() => setConfirmQuote(null)}
        />
      )}
    </div>
  )
}
