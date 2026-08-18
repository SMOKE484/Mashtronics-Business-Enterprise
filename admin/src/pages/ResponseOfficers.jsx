import { useEffect, useState } from 'react'
import { api } from '../api'
import { LoadingState, LoadErrorState, EmptyState, ActionErrorBanner, SaveButton, ConfirmDialog } from '../components/PageState'

function emptyForm() {
  return { name: '', phone: '', email: '', role: '' }
}

export default function ResponseOfficers() {
  const [officers, setOfficers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [saving, setSaving] = useState(false)
  const [inviteResult, setInviteResult] = useState(null)
  const [inviteError, setInviteError] = useState('')
  const [inviteBusyId, setInviteBusyId] = useState(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteErr, setDeleteErr] = useState('')

  function load() {
    if (!officers.length) setLoading(true)
    setLoadError('')
    api.get('/response-officers').then(setOfficers).catch(err => setLoadError(err.message)).finally(() => setLoading(false))
  }

  useEffect(load, [])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm())
    setError('')
    setConfirmingDelete(false)
    setDeleteErr('')
    setShowModal(true)
  }

  function openEdit(officer) {
    setEditingId(officer._id)
    setForm({ name: officer.name, phone: officer.phone, email: officer.email, role: officer.role })
    setError('')
    setConfirmingDelete(false)
    setDeleteErr('')
    setShowModal(true)
  }

  async function confirmDelete() {
    setDeleteBusy(true)
    setDeleteErr('')
    try {
      await api.delete(`/response-officers/${editingId}/permanent`)
      setConfirmingDelete(false)
      setShowModal(false)
      load()
    } catch (err) {
      setDeleteErr(err.message)
    } finally {
      setDeleteBusy(false)
    }
  }

  async function save(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      if (editingId) await api.put(`/response-officers/${editingId}`, form)
      else await api.post('/response-officers', form)
      setShowModal(false)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(officer) {
    setActionError('')
    try {
      if (officer.active) await api.delete(`/response-officers/${officer._id}`)
      else await api.put(`/response-officers/${officer._id}`, { active: true })
      load()
    } catch (err) {
      setActionError(`Couldn't ${officer.active ? 'deactivate' : 'activate'} ${officer.name} — ${err.message}`)
    }
  }

  async function generateInvite(officer) {
    setInviteError('')
    setInviteBusyId(officer._id)
    try {
      const res = await api.post(`/response-officers/${officer._id}/app-invite`)
      setInviteResult({
        name: officer.name, code: res.inviteCode, expiresAt: res.expiresAt,
        phone: officer.phone, smsSent: res.smsSent, smsError: res.smsError,
      })
    } catch (err) {
      setInviteError(`Couldn't generate an invite code for ${officer.name} — ${err.message}.`)
    } finally {
      setInviteBusyId(null)
    }
  }

  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">Armed Response</div>
        <button className="btn btn-primary" onClick={openCreate}><i className="fas fa-plus" /> Add Officer</button>
      </div>

      <ActionErrorBanner onDismiss={() => setActionError('')}>{actionError}</ActionErrorBanner>
      <ActionErrorBanner onDismiss={() => setInviteError('')}>{inviteError}</ActionErrorBanner>

      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <LoadErrorState onRetry={load}>Couldn't load response officers — {loadError}.</LoadErrorState>
      ) : officers.length === 0 ? (
        <EmptyState actionLabel="Add Officer" onAction={openCreate}>
          No response officers yet. Add your armed-response team to start assigning alerts.
        </EmptyState>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th><th>Role</th><th>Phone</th><th>Email</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {officers.map(o => (
              <tr key={o._id}>
                <td className="strong">{o.name}</td>
                <td>{o.role || '—'}</td>
                <td>{o.phone || '—'}</td>
                <td>{o.email || '—'}</td>
                <td><span className={`badge ${o.active ? 'badge--success' : 'badge--neutral'}`}>{o.active ? 'Active' : 'Inactive'}</span></td>
                <td>
                  <div className="table-actions">
                    <button className="btn btn-ghost" onClick={() => openEdit(o)}>Edit</button>
                    <button className="btn btn-ghost" onClick={() => toggleActive(o)}>{o.active ? 'Deactivate' : 'Activate'}</button>
                    <button
                      className="btn btn-ghost"
                      disabled={!o.active || !!o.supabaseUserId || inviteBusyId === o._id}
                      title={o.supabaseUserId ? 'Already linked — no new invite code needed' : undefined}
                      onClick={() => generateInvite(o)}
                    >
                      {o.supabaseUserId ? 'Linked' : inviteBusyId === o._id ? 'Generating…' : 'Invite'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editingId ? 'Edit Officer' : 'Add Officer'}</div>
            <form onSubmit={save}>
              <div className="form-grid form-grid--single">
                <div className="form-field">
                  <label htmlFor="officer-name">Name *</label>
                  <input id="officer-name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label htmlFor="officer-role">Role</label>
                  <input id="officer-role" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. Response Officer" />
                </div>
                <div className="form-field">
                  <label htmlFor="officer-phone">Phone</label>
                  <input id="officer-phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label htmlFor="officer-email">Email</label>
                  <input id="officer-email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              {error && <div className="error-banner"><i className="fas fa-exclamation-circle" />{error}</div>}
              <div className="form-actions" style={editingId ? { justifyContent: 'space-between' } : undefined}>
                {editingId && (
                  <button type="button" className="btn btn-danger" disabled={saving} onClick={() => { setDeleteErr(''); setConfirmingDelete(true) }}>
                    Delete officer
                  </button>
                )}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => setShowModal(false)}>Cancel</button>
                  <SaveButton saving={saving} />
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete officer"
          message={`Delete ${form.name}? This can't be undone.`}
          confirmLabel="Delete"
          busy={deleteBusy}
          error={deleteErr}
          onConfirm={confirmDelete}
          onCancel={() => { setConfirmingDelete(false); setDeleteErr('') }}
        />
      )}

      {inviteResult && (
        <div className="modal-overlay" onClick={() => setInviteResult(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Invite code for {inviteResult.name}</div>
            {inviteResult.smsSent ? (
              <p style={{ color: 'var(--success, #15803d)', fontSize: 13 }}>
                <i className="fas fa-check-circle" /> Sent by SMS to {inviteResult.phone}. They can also be given the code below directly.
              </p>
            ) : (
              <p style={{ color: 'var(--warning, #b45309)', fontSize: 13 }}>
                <i className="fas fa-exclamation-triangle" /> {inviteResult.smsError} Share the code below with {inviteResult.name} directly.
              </p>
            )}
            <div style={{
              fontFamily: 'monospace', fontSize: 22, letterSpacing: 2, textAlign: 'center',
              padding: '12px 16px', borderRadius: 8, background: 'var(--surface-2, #f4f4f5)', margin: '12px 0',
            }}>
              {inviteResult.code}
            </div>
            <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>
              Expires {new Date(inviteResult.expiresAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => navigator.clipboard.writeText(inviteResult.code)}
              >
                Copy code
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setInviteResult(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
