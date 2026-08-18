import { useEffect, useState } from 'react'
import { api } from '../api'
import { LoadingState, LoadErrorState, EmptyState, SaveButton, ConfirmDialog } from '../components/PageState'
import './Compliance.css'

const THRESHOLD_DAYS = 60

function emptyForm() {
  return { name: '', issuedDate: '', expiryDate: '', notes: '' }
}

function deriveStatus(doc) {
  const days = Math.ceil((new Date(doc.expiryDate) - new Date()) / (24 * 60 * 60 * 1000))
  if (days < 0) return { status: 'Expired', note: `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago — renew immediately` }
  if (days <= THRESHOLD_DAYS) return { status: 'Expiring Soon', note: `Expires in ${days} day${days === 1 ? '' : 's'}` }
  return { status: 'Valid', note: `Expires in ${days} day${days === 1 ? '' : 's'}` }
}

const STATUS_BADGE = { Valid: 'badge--success', 'Expiring Soon': 'badge--warning', Expired: 'badge--danger' }
const NOTE_COLOR = { Valid: 'var(--success)', 'Expiring Soon': 'var(--warning)', Expired: 'var(--danger)' }

export default function Compliance() {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDoc, setConfirmDoc] = useState(null)
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState('')

  function load() {
    if (!docs.length) setLoading(true)
    setLoadError('')
    api.get('/compliance').then(setDocs).catch(err => setLoadError(err.message)).finally(() => setLoading(false))
  }

  useEffect(load, [])

  function openCreate() {
    setForm(emptyForm())
    setError('')
    setShowModal(true)
  }

  async function save(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await api.post('/compliance', form)
      setShowModal(false)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    setRemoving(true)
    setRemoveError('')
    try {
      await api.delete(`/compliance/${confirmDoc._id}`)
      setConfirmDoc(null)
      load()
    } catch (err) {
      setRemoveError(`Couldn't remove the document — ${err.message}. It has not been deleted; please try again.`)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div>
      <div className="card-title-row" style={{ marginBottom: '1rem' }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Compliance Documents</div>
        <button className="btn btn-primary" onClick={openCreate}><i className="fas fa-plus" /> Add Document</button>
      </div>

      {loading ? (
        <div className="card"><LoadingState /></div>
      ) : loadError ? (
        <div className="card"><LoadErrorState onRetry={load}>Couldn't load compliance documents — {loadError}.</LoadErrorState></div>
      ) : docs.length === 0 ? (
        <div className="card">
          <EmptyState actionLabel="Add Document" onAction={openCreate}>
            No compliance documents tracked yet. Add B-BBEE, PSiRA, tax clearance and insurance certificates to get expiry alerts.
          </EmptyState>
        </div>
      ) : (
        <div className="compliance-grid">
          {docs.map(doc => {
            const { status, note } = deriveStatus(doc)
            return (
              <div key={doc._id} className="compliance-card">
                <div className="compliance-card-top">
                  <div className="compliance-name">{doc.name}</div>
                  <span className={`badge ${STATUS_BADGE[status]}`}>{status}</span>
                </div>
                <div className="compliance-meta">Issued {new Date(doc.issuedDate).toLocaleDateString('en-ZA')}</div>
                <div className="compliance-meta">Expires {new Date(doc.expiryDate).toLocaleDateString('en-ZA')}</div>
                <div className="compliance-note" style={{ color: NOTE_COLOR[status] }}>{note}</div>
                <button className="btn btn-ghost" style={{ marginTop: '0.75rem' }} onClick={() => { setRemoveError(''); setConfirmDoc(doc) }}>Remove</button>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add Compliance Document</div>
            <form onSubmit={save}>
              <div className="form-grid form-grid--single">
                <div className="form-field">
                  <label htmlFor="cd-name">Document Name *</label>
                  <input id="cd-name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. B-BBEE Certificate" />
                </div>
                <div className="form-grid">
                  <div className="form-field">
                    <label htmlFor="cd-issued">Issued Date *</label>
                    <input id="cd-issued" type="date" required value={form.issuedDate} onChange={e => setForm(f => ({ ...f, issuedDate: e.target.value }))} />
                  </div>
                  <div className="form-field">
                    <label htmlFor="cd-expiry">Expiry Date *</label>
                    <input id="cd-expiry" type="date" required value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
                  </div>
                </div>
                <div className="form-field">
                  <label htmlFor="cd-notes">Notes</label>
                  <textarea id="cd-notes" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              {error && <div className="error-banner"><i className="fas fa-exclamation-circle" />{error}</div>}
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => setShowModal(false)}>Cancel</button>
                <SaveButton saving={saving} />
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDoc && (
        <ConfirmDialog
          title="Remove document"
          message={`Remove "${confirmDoc.name}" from compliance tracking? You'll stop getting expiry alerts for it.`}
          confirmLabel="Remove"
          busy={removing}
          error={removeError}
          onConfirm={remove}
          onCancel={() => setConfirmDoc(null)}
        />
      )}
    </div>
  )
}
