import { useEffect, useState } from 'react'
import { api } from '../api'
import { LoadingState, LoadErrorState, EmptyState, ActionErrorBanner, SaveButton, ConfirmDialog } from '../components/PageState'

function emptyForm() {
  return { name: '', phone: '', email: '', role: '' }
}

export default function Technicians() {
  const [technicians, setTechnicians] = useState([])
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
  const [deleteConfirm, setDeleteConfirm] = useState(null) // { jobCount, reassignTo } once the pre-delete check resolves
  const [deleteChecking, setDeleteChecking] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteErr, setDeleteErr] = useState('')

  function load() {
    if (!technicians.length) setLoading(true)
    setLoadError('')
    api.get('/technicians').then(setTechnicians).catch(err => setLoadError(err.message)).finally(() => setLoading(false))
  }

  useEffect(load, [])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm())
    setError('')
    setDeleteConfirm(null)
    setDeleteErr('')
    setShowModal(true)
  }

  function openEdit(tech) {
    setEditingId(tech._id)
    setForm({ name: tech.name, phone: tech.phone, email: tech.email, role: tech.role })
    setError('')
    setDeleteConfirm(null)
    setDeleteErr('')
    setShowModal(true)
  }

  async function startDelete() {
    setDeleteErr('')
    setDeleteChecking(true)
    try {
      const { count } = await api.get(`/technicians/${editingId}/jobs-count`)
      setDeleteConfirm({ jobCount: count, reassignTo: '' })
    } catch (err) {
      setDeleteErr(err.message)
    } finally {
      setDeleteChecking(false)
    }
  }

  async function confirmDelete() {
    setDeleteBusy(true)
    setDeleteErr('')
    try {
      const body = deleteConfirm.jobCount > 0 ? { reassignTo: deleteConfirm.reassignTo || null } : {}
      await api.delete(`/technicians/${editingId}/permanent`, body)
      setDeleteConfirm(null)
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
      if (editingId) await api.put(`/technicians/${editingId}`, form)
      else await api.post('/technicians', form)
      setShowModal(false)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(tech) {
    setActionError('')
    try {
      if (tech.active) await api.delete(`/technicians/${tech._id}`)
      else await api.put(`/technicians/${tech._id}`, { active: true })
      load()
    } catch (err) {
      setActionError(`Couldn't ${tech.active ? 'deactivate' : 'activate'} ${tech.name} — ${err.message}`)
    }
  }

  async function generateInvite(tech) {
    setInviteError('')
    setInviteBusyId(tech._id)
    try {
      const res = await api.post(`/technicians/${tech._id}/app-invite`)
      setInviteResult({
        name: tech.name, code: res.inviteCode, expiresAt: res.expiresAt,
        phone: tech.phone, smsSent: res.smsSent, smsError: res.smsError,
      })
    } catch (err) {
      setInviteError(`Couldn't generate an invite code for ${tech.name} — ${err.message}.`)
    } finally {
      setInviteBusyId(null)
    }
  }

  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">Technicians</div>
        <button className="btn btn-primary" onClick={openCreate}><i className="fas fa-plus" /> Add Technician</button>
      </div>

      <ActionErrorBanner onDismiss={() => setActionError('')}>{actionError}</ActionErrorBanner>
      <ActionErrorBanner onDismiss={() => setInviteError('')}>{inviteError}</ActionErrorBanner>

      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <LoadErrorState onRetry={load}>Couldn't load technicians — {loadError}.</LoadErrorState>
      ) : technicians.length === 0 ? (
        <EmptyState actionLabel="Add Technician" onAction={openCreate}>
          No technicians yet. Add your field team to start assigning jobs.
        </EmptyState>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th><th>Role</th><th>Phone</th><th>Email</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {technicians.map(t => (
              <tr key={t._id}>
                <td className="strong">{t.name}</td>
                <td>{t.role || '—'}</td>
                <td>{t.phone || '—'}</td>
                <td>{t.email || '—'}</td>
                <td><span className={`badge ${t.active ? 'badge--success' : 'badge--neutral'}`}>{t.active ? 'Active' : 'Inactive'}</span></td>
                <td>
                  <div className="table-actions">
                    <button className="btn btn-ghost" onClick={() => openEdit(t)}>Edit</button>
                    <button className="btn btn-ghost" onClick={() => toggleActive(t)}>{t.active ? 'Deactivate' : 'Activate'}</button>
                    <button
                      className="btn btn-ghost"
                      disabled={!t.active || !!t.supabaseUserId || inviteBusyId === t._id}
                      title={t.supabaseUserId ? 'Already linked — no new invite code needed' : undefined}
                      onClick={() => generateInvite(t)}
                    >
                      {t.supabaseUserId ? 'Linked' : inviteBusyId === t._id ? 'Generating…' : 'Invite'}
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
            <div className="modal-title">{editingId ? 'Edit Technician' : 'Add Technician'}</div>
            <form onSubmit={save}>
              <div className="form-grid form-grid--single">
                <div className="form-field">
                  <label htmlFor="tech-name">Name *</label>
                  <input id="tech-name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label htmlFor="tech-role">Role</label>
                  <input id="tech-role" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. CCTV Installer" />
                </div>
                <div className="form-field">
                  <label htmlFor="tech-phone">Phone</label>
                  <input id="tech-phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label htmlFor="tech-email">Email</label>
                  <input id="tech-email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              {error && <div className="error-banner"><i className="fas fa-exclamation-circle" />{error}</div>}
              <div className="form-actions" style={editingId ? { justifyContent: 'space-between' } : undefined}>
                {editingId && (
                  <button type="button" className="btn btn-danger" disabled={deleteChecking || saving} onClick={startDelete}>
                    {deleteChecking ? <><i className="fas fa-spinner fa-spin" /> Checking…</> : 'Delete technician'}
                  </button>
                )}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => setShowModal(false)}>Cancel</button>
                  <SaveButton saving={saving} />
                </div>
              </div>
              {deleteErr && !deleteConfirm && <div className="error-banner"><i className="fas fa-exclamation-circle" />{deleteErr}</div>}
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <ConfirmDialog
          title="Delete technician"
          message={
            deleteConfirm.jobCount > 0
              ? `${form.name} has ${deleteConfirm.jobCount} job${deleteConfirm.jobCount === 1 ? '' : 's'} assigned. Choose what happens to ${deleteConfirm.jobCount === 1 ? 'it' : 'them'} below — deleting the technician can't be undone.`
              : `Delete ${form.name}? This can't be undone.`
          }
          confirmLabel="Delete"
          busy={deleteBusy}
          error={deleteErr}
          onConfirm={confirmDelete}
          onCancel={() => { setDeleteConfirm(null); setDeleteErr('') }}
        >
          {deleteConfirm.jobCount > 0 && (
            <div className="form-field" style={{ marginTop: '0.25rem', marginBottom: '0.75rem' }}>
              <label htmlFor="reassign-to">Reassign their jobs to</label>
              <select
                id="reassign-to"
                value={deleteConfirm.reassignTo}
                onChange={e => setDeleteConfirm(c => ({ ...c, reassignTo: e.target.value }))}
              >
                <option value="">Leave unassigned</option>
                {technicians.filter(t => t._id !== editingId && t.active).map(t => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}
        </ConfirmDialog>
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
