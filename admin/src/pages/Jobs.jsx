import { useEffect, useState } from 'react'
import { api } from '../api'
import { LoadingState, LoadErrorState, EmptyState, ActionErrorBanner, SaveButton, ConfirmDialog } from '../components/PageState'

function emptyForm() {
  return { clientRef: '', technicianRef: '', site: '', jobType: '', scheduledDate: '', scheduledTime: '', priority: 'Medium', notes: '', checklist: [], parts: '' }
}

const STATUS_BADGE = { Scheduled: 'badge--info', 'In Progress': 'badge--warning', Completed: 'badge--success', Cancelled: 'badge--neutral' }
const STATUSES = ['Scheduled', 'In Progress', 'Completed', 'Cancelled']

export default function Jobs() {
  const [jobs, setJobs] = useState([])
  const [clients, setClients] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmJob, setConfirmJob] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  function load() {
    if (!jobs.length) setLoading(true)
    setLoadError('')
    Promise.all([api.get('/jobs'), api.get('/clients'), api.get('/technicians')])
      .then(([j, c, t]) => { setJobs(j); setClients(c); setTechnicians(t) })
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

  function openEdit(job) {
    setEditingId(job._id)
    setForm({
      clientRef: job.clientRef?._id || '',
      technicianRef: job.technicianRef?._id || '',
      site: job.site || '',
      jobType: job.jobType,
      scheduledDate: job.scheduledDate ? job.scheduledDate.slice(0, 10) : '',
      scheduledTime: job.scheduledTime || '',
      priority: job.priority,
      notes: job.notes || '',
      // Keep done flags intact — the admin edits labels, the technician owns
      // ticking things off.
      checklist: (job.checklist || []).map(i => ({ label: i.label, done: i.done })),
      parts: (job.parts || []).join('\n'),
    })
    setError('')
    setShowModal(true)
  }

  function setChecklistLabel(index, label) {
    setForm(f => ({ ...f, checklist: f.checklist.map((item, i) => i === index ? { ...item, label } : item) }))
  }

  function addChecklistItem() {
    setForm(f => ({ ...f, checklist: [...f.checklist, { label: '', done: false }] }))
  }

  function removeChecklistItem(index) {
    setForm(f => ({ ...f, checklist: f.checklist.filter((_, i) => i !== index) }))
  }

  async function save(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const checklist = form.checklist
        .map(i => ({ label: i.label.trim(), done: i.done }))
        .filter(i => i.label)
      const body = {
        ...form,
        technicianRef: form.technicianRef || undefined,
        parts: form.parts.split('\n').map(p => p.trim()).filter(Boolean),
        // On create, an empty checklist is omitted so the server applies the
        // standard template for the job type.
        checklist: checklist.length > 0 ? checklist : (editingId ? [] : undefined),
      }
      if (editingId) await api.put(`/jobs/${editingId}`, body)
      else await api.post('/jobs', body)
      setShowModal(false)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function setStatus(job, status) {
    setActionError('')
    try {
      await api.patch(`/jobs/${job._id}/status`, { status })
    } catch (err) {
      setActionError(`Couldn't update the status of "${job.jobType}" — ${err.message}. Please try again.`)
    }
    load() // refresh on failure too, so the dropdown snaps back to what's actually saved
  }

  async function deleteJob() {
    setDeleting(true)
    setDeleteError('')
    try {
      await api.delete(`/jobs/${confirmJob._id}`)
      setConfirmJob(null)
      load()
    } catch (err) {
      setDeleteError(`Couldn't delete "${confirmJob.jobType}" — ${err.message}. Please try again.`)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="card">
      <div className="card-title-row">
        <div className="card-title">Work Orders</div>
        <button className="btn btn-primary" onClick={openCreate}><i className="fas fa-plus" /> Add Job</button>
      </div>

      <ActionErrorBanner onDismiss={() => setActionError('')}>{actionError}</ActionErrorBanner>

      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <LoadErrorState onRetry={load}>Couldn't load work orders — {loadError}.</LoadErrorState>
      ) : jobs.length === 0 ? (
        <EmptyState actionLabel="Add Job" onAction={openCreate}>
          No jobs yet. Create a job to start scheduling technicians.
        </EmptyState>
      ) : (
        <table className="data-table">
          <thead>
            <tr><th>Client</th><th>Site</th><th>Job Type</th><th>Technician</th><th>Date</th><th>Priority</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {jobs.map(j => (
              <tr key={j._id}>
                <td className="strong">{j.clientRef?.name || '—'}</td>
                <td>{j.site || '—'}</td>
                <td>{j.jobType}</td>
                <td>{j.technicianRef?.name || 'Unassigned'}</td>
                <td>{new Date(j.scheduledDate).toLocaleDateString('en-ZA')}{j.scheduledTime ? ` ${j.scheduledTime}` : ''}</td>
                <td>{j.priority}</td>
                <td>
                  <select
                    className={`badge ${STATUS_BADGE[j.status]}`}
                    style={{ border: 'none', cursor: 'pointer' }}
                    value={j.status}
                    onChange={e => setStatus(j, e.target.value)}
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td>
                  <div className="table-actions">
                    <button className="btn btn-ghost" onClick={() => openEdit(j)}>Edit</button>
                    <button className="btn btn-ghost" onClick={() => { setDeleteError(''); setConfirmJob(j) }}>Delete</button>
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
            <div className="modal-title">{editingId ? 'Edit Job' : 'Add Job'}</div>
            <form onSubmit={save}>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="job-client">Client *</label>
                  <select id="job-client" required value={form.clientRef} onChange={e => setForm(f => ({ ...f, clientRef: e.target.value }))}>
                    <option value="">— Select —</option>
                    {clients.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="job-tech">Technician</label>
                  <select id="job-tech" value={form.technicianRef} onChange={e => setForm(f => ({ ...f, technicianRef: e.target.value }))}>
                    <option value="">Unassigned</option>
                    {technicians.filter(t => t.active).map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="job-type">Job Type *</label>
                  <input id="job-type" required value={form.jobType} onChange={e => setForm(f => ({ ...f, jobType: e.target.value }))} placeholder="e.g. CCTV install" />
                </div>
                <div className="form-field">
                  <label htmlFor="job-site">Site</label>
                  <input id="job-site" value={form.site} onChange={e => setForm(f => ({ ...f, site: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label htmlFor="job-date">Date *</label>
                  <input id="job-date" type="date" required value={form.scheduledDate} onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label htmlFor="job-time">Time</label>
                  <input id="job-time" type="time" value={form.scheduledTime} onChange={e => setForm(f => ({ ...f, scheduledTime: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label htmlFor="job-priority">Priority</label>
                  <select id="job-priority" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    <option>Low</option><option>Medium</option><option>High</option><option>Urgent</option>
                  </select>
                </div>
              </div>
              <div className="form-grid form-grid--single" style={{ marginTop: '0.85rem' }}>
                <div className="form-field">
                  <label htmlFor="job-notes">Notes</label>
                  <textarea id="job-notes" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label>On-site checklist</label>
                  {form.checklist.map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <input type="checkbox" checked={item.done} disabled title="Ticked off by the technician on site" style={{ flexShrink: 0 }} />
                      <input
                        required
                        value={item.label}
                        onChange={e => setChecklistLabel(i, e.target.value)}
                        placeholder="Checklist step"
                        style={{ flex: 1 }}
                      />
                      <button type="button" className="btn btn-ghost" onClick={() => removeChecklistItem(i)} aria-label="Remove item">✕</button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-ghost" onClick={addChecklistItem} style={{ alignSelf: 'flex-start' }}>
                    <i className="fas fa-plus" /> Add item
                  </button>
                  {!editingId && form.checklist.length === 0 && (
                    <div className="form-hint" style={{ fontSize: '0.78rem', color: 'var(--text-muted, #6b7e8c)', marginTop: '0.2rem' }}>
                      Leave empty to use the standard checklist for this job type.
                    </div>
                  )}
                </div>
                <div className="form-field">
                  <label htmlFor="job-parts">Parts &amp; equipment (one per line)</label>
                  <textarea id="job-parts" rows={3} value={form.parts} onChange={e => setForm(f => ({ ...f, parts: e.target.value }))} placeholder={'PoE injector\nCat6 cable — 40m'} />
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

      {confirmJob && (
        <ConfirmDialog
          title="Delete job"
          message={`Delete "${confirmJob.jobType}" for ${confirmJob.clientRef?.name || 'this client'}? This can't be undone.`}
          confirmLabel="Delete"
          busy={deleting}
          error={deleteError}
          onConfirm={deleteJob}
          onCancel={() => setConfirmJob(null)}
        />
      )}
    </div>
  )
}
