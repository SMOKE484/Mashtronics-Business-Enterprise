import { useEffect, useState } from 'react'
import { api, ZAR } from '../api'
import { LoadingState, LoadErrorState, EmptyState, ActionErrorBanner, SaveButton, ConfirmDialog } from '../components/PageState'

function emptyForm() {
  return { clientRef: '', subtotal: '', issuedDate: '', dueDate: '' }
}

function deriveStatus(inv) {
  if (inv.status === 'paid') return 'paid'
  if (new Date(inv.dueDate) < new Date()) return 'overdue'
  return 'sent'
}

const STATUS_BADGE = { paid: 'badge--success', sent: 'badge--info', overdue: 'badge--danger' }
const STATUS_LABEL = { paid: 'Paid', sent: 'Sent', overdue: 'Overdue' }

export default function Invoicing() {
  const [invoices, setInvoices] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmInvoice, setConfirmInvoice] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  function load() {
    if (!invoices.length) setLoading(true)
    setLoadError('')
    Promise.all([api.get('/invoices'), api.get('/clients')])
      .then(([i, c]) => { setInvoices(i); setClients(c) })
      .catch(err => setLoadError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm())
    setError('')
    setShowModal(true)
  }

  function openEdit(inv) {
    setEditingId(inv._id)
    setForm({
      clientRef: inv.clientRef?._id || '',
      subtotal: String(inv.subtotal),
      issuedDate: inv.issuedDate ? inv.issuedDate.slice(0, 10) : '',
      dueDate: inv.dueDate ? inv.dueDate.slice(0, 10) : '',
    })
    setError('')
    setShowModal(true)
  }

  async function save(e) {
    e.preventDefault()
    setError('')
    const subtotal = Number(form.subtotal) || 0
    const vatAmount = Math.round(subtotal * 0.15 * 100) / 100
    setSaving(true)
    try {
      const body = { clientRef: form.clientRef, subtotal, vatAmount, issuedDate: form.issuedDate, dueDate: form.dueDate }
      if (editingId) await api.put(`/invoices/${editingId}`, body)
      else await api.post('/invoices', body)
      setShowModal(false)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function markPaid(inv) {
    setActionError('')
    try {
      await api.patch(`/invoices/${inv._id}/status`, { status: 'paid' })
      load()
    } catch (err) {
      setActionError(`Couldn't mark ${inv.invoiceNumber} as paid — ${err.message}. The invoice is unchanged; please try again.`)
    }
  }

  async function deleteInvoice() {
    setDeleting(true)
    setDeleteError('')
    try {
      await api.delete(`/invoices/${confirmInvoice._id}`)
      setConfirmInvoice(null)
      load()
    } catch (err) {
      setDeleteError(`Couldn't delete ${confirmInvoice.invoiceNumber} — ${err.message}. Please try again.`)
    } finally {
      setDeleting(false)
    }
  }

  const withStatus = invoices.map(i => ({ ...i, derivedStatus: deriveStatus(i) }))
  const paidTotal = withStatus.filter(i => i.derivedStatus === 'paid').reduce((s, i) => s + i.amount, 0)
  const sentTotal = withStatus.filter(i => i.derivedStatus === 'sent').reduce((s, i) => s + i.amount, 0)
  const overdueTotal = withStatus.filter(i => i.derivedStatus === 'overdue').reduce((s, i) => s + i.amount, 0)
  const subtotalPreview = Number(form.subtotal) || 0

  return (
    <div>
      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Paid</div><div className="kpi-value">{ZAR(paidTotal)}</div></div>
        <div className="kpi-card"><div className="kpi-label">Sent, awaiting payment</div><div className="kpi-value">{ZAR(sentTotal)}</div></div>
        <div className="kpi-card"><div className="kpi-label">Overdue</div><div className="kpi-value kpi-value--danger">{ZAR(overdueTotal)}</div></div>
      </div>

      <div className="card">
        <div className="card-title-row">
          <div className="card-title">Invoices</div>
          <button className="btn btn-primary" onClick={openCreate}><i className="fas fa-plus" /> New Invoice</button>
        </div>

        <ActionErrorBanner onDismiss={() => setActionError('')}>{actionError}</ActionErrorBanner>

        {loading ? (
          <LoadingState />
        ) : loadError ? (
          <LoadErrorState onRetry={load}>Couldn't load invoices — {loadError}.</LoadErrorState>
        ) : withStatus.length === 0 ? (
          <EmptyState actionLabel="New Invoice" onAction={openCreate}>
            No invoices yet. Issue your first invoice and it will appear here with payment tracking.
          </EmptyState>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Invoice #</th><th>Client</th><th>Amount</th><th>Issued</th><th>Due</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {withStatus.map(inv => (
                <tr key={inv._id}>
                  <td className="strong">{inv.invoiceNumber}</td>
                  <td>{inv.clientRef?.name || '—'}</td>
                  <td>{ZAR(inv.amount)}</td>
                  <td>{new Date(inv.issuedDate).toLocaleDateString('en-ZA')}</td>
                  <td>{new Date(inv.dueDate).toLocaleDateString('en-ZA')}</td>
                  <td><span className={`badge ${STATUS_BADGE[inv.derivedStatus]}`}>{STATUS_LABEL[inv.derivedStatus]}</span></td>
                  <td>
                    <div className="table-actions">
                      {inv.derivedStatus !== 'paid' && (
                        <button className="btn btn-ghost" onClick={() => markPaid(inv)}>Mark Paid</button>
                      )}
                      <button className="btn btn-ghost" onClick={() => openEdit(inv)}>Edit</button>
                      <button className="btn btn-ghost" onClick={() => { setDeleteError(''); setConfirmInvoice(inv) }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editingId ? 'Edit Invoice' : 'New Invoice'}</div>
            <form onSubmit={save}>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="inv-client">Client *</label>
                  <select id="inv-client" required value={form.clientRef} onChange={e => setForm(f => ({ ...f, clientRef: e.target.value }))}>
                    <option value="">— Select —</option>
                    {clients.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="inv-subtotal">Subtotal (excl VAT) *</label>
                  <input id="inv-subtotal" type="number" min="0" step="0.01" required value={form.subtotal} onChange={e => setForm(f => ({ ...f, subtotal: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label htmlFor="inv-issued">Issued Date *</label>
                  <input id="inv-issued" type="date" required value={form.issuedDate} onChange={e => setForm(f => ({ ...f, issuedDate: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label htmlFor="inv-due">Due Date *</label>
                  <input id="inv-due" type="date" required value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
                </div>
              </div>
              <div style={{ marginTop: '0.85rem', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                VAT (15%): {ZAR(Math.round(subtotalPreview * 0.15 * 100) / 100)} · Total: {ZAR(Math.round(subtotalPreview * 1.15 * 100) / 100)}
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

      {confirmInvoice && (
        <ConfirmDialog
          title="Delete invoice"
          message={`Delete ${confirmInvoice.invoiceNumber}? This will remove it from ${confirmInvoice.clientRef?.name || 'this client'}'s invoiced total. This can't be undone.`}
          confirmLabel="Delete"
          busy={deleting}
          error={deleteError}
          onConfirm={deleteInvoice}
          onCancel={() => setConfirmInvoice(null)}
        />
      )}
    </div>
  )
}
