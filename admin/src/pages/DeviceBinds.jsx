import { useEffect, useState } from 'react'
import { api } from '../api'
import { LoadingState, LoadErrorState, EmptyState, ActionErrorBanner, SaveButton, ConfirmDialog } from '../components/PageState'

function emptyAssignForm() {
  return { clientRef: '', name: '', location: '' }
}

export default function DeviceBinds() {
  const [binds, setBinds] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')

  const [assigning, setAssigning] = useState(null) // the pending-bind being assigned
  const [assignForm, setAssignForm] = useState(emptyAssignForm())
  const [assignError, setAssignError] = useState('')
  const [saving, setSaving] = useState(false)

  const [confirmIgnore, setConfirmIgnore] = useState(null)
  const [ignoring, setIgnoring] = useState(false)
  const [ignoreError, setIgnoreError] = useState('')

  function load() {
    if (!binds.length) setLoading(true)
    setLoadError('')
    Promise.all([api.get('/dahua-pending-binds'), api.get('/clients')])
      .then(([b, c]) => { setBinds(b); setClients(c) })
      .catch(err => setLoadError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function openAssign(bind) {
    setAssigning(bind)
    setAssignError('')
    setAssignForm({
      clientRef: bind.suggestedClientRef?._id || '',
      name: '',
      location: '',
    })
  }

  async function submitAssign(e) {
    e.preventDefault()
    setSaving(true)
    setAssignError('')
    try {
      await api.post(`/dahua-pending-binds/${assigning._id}/resolve`, assignForm)
      setAssigning(null)
      load()
    } catch (err) {
      setAssignError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function confirmIgnoreBind() {
    setIgnoring(true)
    setIgnoreError('')
    try {
      await api.post(`/dahua-pending-binds/${confirmIgnore._id}/ignore`)
      setConfirmIgnore(null)
      load()
    } catch (err) {
      setIgnoreError(`Couldn't ignore this device — ${err.message}. Please try again.`)
    } finally {
      setIgnoring(false)
    }
  }

  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">Pending Device Binds</div>
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
        Devices a customer has shared with Mashtronics' ARC account but that aren't assigned to a client yet.
      </p>

      <ActionErrorBanner onDismiss={() => setActionError('')}>{actionError}</ActionErrorBanner>

      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <LoadErrorState onRetry={load}>Couldn't load pending device binds — {loadError}.</LoadErrorState>
      ) : binds.length === 0 ? (
        <EmptyState>
          No pending device binds. When a customer shares a Dahua device with Mashtronics' ARC account, it'll show up here for you to assign to a client.
        </EmptyState>
      ) : (
        <table className="data-table">
          <thead>
            <tr><th>Device Serial</th><th>Owner</th><th>Suggested Client</th><th>Received</th><th></th></tr>
          </thead>
          <tbody>
            {binds.map(b => (
              <tr key={b._id}>
                <td className="strong">{b.deviceSerial}</td>
                <td>{b.ownerEmail || b.ownerPhone || '—'}</td>
                <td>{b.suggestedClientRef?.name || '—'}</td>
                <td>{new Date(b.receivedAt).toLocaleString('en-ZA')}</td>
                <td>
                  <div className="table-actions">
                    <button className="btn btn-primary" onClick={() => openAssign(b)}>Assign to client</button>
                    <button className="btn btn-ghost" onClick={() => { setIgnoreError(''); setConfirmIgnore(b) }}>Ignore</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {assigning && (
        <div className="modal-overlay" onClick={() => setAssigning(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Assign {assigning.deviceSerial} to a client</div>
            <form onSubmit={submitAssign}>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="bind-client">Client *</label>
                  <select id="bind-client" required value={assignForm.clientRef} onChange={e => setAssignForm(f => ({ ...f, clientRef: e.target.value }))}>
                    <option value="">— Select —</option>
                    {clients.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                  {assigning.suggestedClientRef && (
                    <div className="form-hint" style={{ fontSize: '0.78rem', color: 'var(--text-muted, #6b7e8c)', marginTop: '0.2rem' }}>
                      Suggested from the device owner's contact details — double-check before assigning.
                    </div>
                  )}
                </div>
                <div className="form-field">
                  <label htmlFor="bind-name">Camera name</label>
                  <input id="bind-name" value={assignForm.name} onChange={e => setAssignForm(f => ({ ...f, name: e.target.value }))} placeholder={`Device ${assigning.deviceSerial}`} />
                </div>
                <div className="form-field">
                  <label htmlFor="bind-location">Location</label>
                  <input id="bind-location" value={assignForm.location} onChange={e => setAssignForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Front Gate" />
                </div>
              </div>
              {assignError && <div className="error-banner"><i className="fas fa-exclamation-circle" />{assignError}</div>}
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => setAssigning(null)}>Cancel</button>
                <SaveButton saving={saving} label="Assign" savingLabel="Assigning…" />
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmIgnore && (
        <ConfirmDialog
          title="Ignore this device?"
          message={`"${confirmIgnore.deviceSerial}" won't be assigned to a client. If it's shared with the ARC account again later, it'll reappear here.`}
          confirmLabel="Ignore"
          busy={ignoring}
          error={ignoreError}
          onConfirm={confirmIgnoreBind}
          onCancel={() => setConfirmIgnore(null)}
        />
      )}
    </div>
  )
}
