import { useEffect, useState } from 'react'
import { api } from '../api'
import { LoadingState, LoadErrorState, EmptyState, SaveButton, ConfirmDialog } from '../components/PageState'

function emptyForm() {
  return { clientRef: '', service: '', frequency: '', contractSince: '', nextVisit: '' }
}

function deriveStatus(c) {
  if (!c.active) return 'Contract ended'
  if (new Date(c.nextVisit) < new Date()) return 'Overdue'
  return 'Upcoming'
}

const STATUS_BADGE = { Upcoming: 'badge--info', Overdue: 'badge--danger', 'Contract ended': 'badge--neutral' }

export default function Maintenance() {
  const [contracts, setContracts] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmContract, setConfirmContract] = useState(null)
  const [ending, setEnding] = useState(false)
  const [endError, setEndError] = useState('')

  function load() {
    if (!contracts.length) setLoading(true)
    setLoadError('')
    Promise.all([api.get('/maintenance'), api.get('/clients')])
      .then(([m, c]) => { setContracts(m); setClients(c) })
      .catch(err => setLoadError(err.message))
      .finally(() => setLoading(false))
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
      await api.post('/maintenance', form)
      setShowModal(false)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function endContract() {
    setEnding(true)
    setEndError('')
    try {
      await api.delete(`/maintenance/${confirmContract._id}`)
      setConfirmContract(null)
      load()
    } catch (err) {
      setEndError(`Couldn't end the contract — ${err.message}. It's still active; please try again.`)
    } finally {
      setEnding(false)
    }
  }

  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">Maintenance Contracts</div>
        <button className="btn btn-primary" onClick={openCreate}><i className="fas fa-plus" /> Add Contract</button>
      </div>

      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <LoadErrorState onRetry={load}>Couldn't load maintenance contracts — {loadError}.</LoadErrorState>
      ) : contracts.length === 0 ? (
        <EmptyState actionLabel="Add Contract" onAction={openCreate}>
          No maintenance contracts yet. Add one to track visit schedules and renewals.
        </EmptyState>
      ) : (
        <table className="data-table">
          <thead>
            <tr><th>Client</th><th>Service</th><th>Frequency</th><th>Contract Since</th><th>Next Visit</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {contracts.map(c => {
              const status = deriveStatus(c)
              return (
                <tr key={c._id}>
                  <td className="strong">{c.clientRef?.name || '—'}</td>
                  <td>{c.service}</td>
                  <td>{c.frequency}</td>
                  <td>{new Date(c.contractSince).getFullYear()}</td>
                  <td>{status === 'Contract ended' ? '—' : new Date(c.nextVisit).toLocaleDateString('en-ZA')}</td>
                  <td><span className={`badge ${STATUS_BADGE[status]}`}>{status}</span></td>
                  <td>{c.active && <button className="btn btn-ghost" onClick={() => { setEndError(''); setConfirmContract(c) }}>End Contract</button>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add Maintenance Contract</div>
            <form onSubmit={save}>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="mc-client">Client *</label>
                  <select id="mc-client" required value={form.clientRef} onChange={e => setForm(f => ({ ...f, clientRef: e.target.value }))}>
                    <option value="">— Select —</option>
                    {clients.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="mc-service">Service *</label>
                  <input id="mc-service" required value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))} placeholder="e.g. CCTV maintenance" />
                </div>
                <div className="form-field">
                  <label htmlFor="mc-frequency">Frequency *</label>
                  <select id="mc-frequency" required value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                    <option value="">— Select —</option>
                    <option>Monthly</option><option>Quarterly</option><option>Bi-annual</option><option>Annual</option>
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="mc-since">Contract Since *</label>
                  <input id="mc-since" type="date" required value={form.contractSince} onChange={e => setForm(f => ({ ...f, contractSince: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label htmlFor="mc-next">Next Visit *</label>
                  <input id="mc-next" type="date" required value={form.nextVisit} onChange={e => setForm(f => ({ ...f, nextVisit: e.target.value }))} />
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

      {confirmContract && (
        <ConfirmDialog
          title="End contract"
          message={`End the ${confirmContract.service} contract for ${confirmContract.clientRef?.name || 'this client'}? Scheduled visits will stop.`}
          confirmLabel="End Contract"
          busy={ending}
          error={endError}
          onConfirm={endContract}
          onCancel={() => setConfirmContract(null)}
        />
      )}
    </div>
  )
}
