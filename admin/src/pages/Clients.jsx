import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ZAR } from '../api'
import { LoadingState, LoadErrorState, EmptyState, SaveButton } from '../components/PageState'

function emptyForm() {
  return { name: '', sector: '', status: 'active', scopeOfWork: '', billingAddress: '', contactName: '', contactPhone: '', contactEmail: '', notes: '' }
}

const STATUS_BADGE = { active: 'badge--success', prospect: 'badge--info', inactive: 'badge--neutral' }
const STATUS_LABEL = { active: 'Active', prospect: 'Prospect', inactive: 'Inactive' }

export default function Clients() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)

  function load() {
    if (!clients.length) setLoading(true)
    setLoadError('')
    api.get('/clients').then(setClients).catch(err => setLoadError(err.message)).finally(() => setLoading(false))
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
      const created = await api.post('/clients', form)
      setShowModal(false)
      load()
      navigate(`/clients/${created._id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">All Clients</div>
        <button className="btn btn-primary" onClick={openCreate}><i className="fas fa-plus" /> Add Client</button>
      </div>

      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <LoadErrorState onRetry={load}>Couldn't load your clients — {loadError}.</LoadErrorState>
      ) : clients.length === 0 ? (
        <EmptyState actionLabel="Add Client" onAction={openCreate}>
          No clients yet. Add your first client to start tracking quotes, jobs and invoices.
        </EmptyState>
      ) : (
        <table className="data-table">
          <thead>
            <tr><th>Client</th><th>Sector</th><th>Since</th><th>Total Invoiced</th><th>Status</th></tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c._id} className="clickable" onClick={() => navigate(`/clients/${c._id}`)}>
                <td className="strong">{c.name}</td>
                <td>{c.sector || '—'}</td>
                <td>{c.clientSince ? new Date(c.clientSince).getFullYear() : '—'}</td>
                <td>{ZAR(c.totalInvoiced)}</td>
                <td><span className={`badge ${STATUS_BADGE[c.status]}`}>{STATUS_LABEL[c.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add Client</div>
            <form onSubmit={save}>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="cl-name">Name *</label>
                  <input id="cl-name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label htmlFor="cl-sector">Sector</label>
                  <input id="cl-sector" value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))} placeholder="e.g. Public Sector" />
                </div>
                <div className="form-field">
                  <label htmlFor="cl-status">Status</label>
                  <select id="cl-status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="active">Active</option>
                    <option value="prospect">Prospect</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="cl-contact-name">Contact Person</label>
                  <input id="cl-contact-name" value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label htmlFor="cl-contact-phone">Contact Phone</label>
                  <input id="cl-contact-phone" value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label htmlFor="cl-contact-email">Contact Email</label>
                  <input id="cl-contact-email" type="email" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} />
                </div>
              </div>
              <div className="form-grid form-grid--single" style={{ marginTop: '0.85rem' }}>
                <div className="form-field">
                  <label htmlFor="cl-scope">Scope of Work</label>
                  <textarea id="cl-scope" rows={2} value={form.scopeOfWork} onChange={e => setForm(f => ({ ...f, scopeOfWork: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label htmlFor="cl-address">Billing Address</label>
                  <textarea id="cl-address" rows={2} value={form.billingAddress} onChange={e => setForm(f => ({ ...f, billingAddress: e.target.value }))} />
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
    </div>
  )
}
