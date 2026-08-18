import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, ZAR } from '../api'
import { LoadingState, LoadErrorState, EmptyState, SaveButton, ConfirmDialog } from '../components/PageState'
import LivePlayer from '../components/LivePlayer'
import './ClientDetail.css'

// Live view is real streaming video (LivePlayer — Dahua's plugin-free web
// player over websocket+RTSP) as of 2026-08-04. The snapshot-polling path
// below is kept as an explicit fallback the admin can switch to when the
// stream won't start. 5s comfortably respects Dahua's documented >=3s rate
// limit between snapshot calls.
const LIVE_VIEW_POLL_MS = 5000

function emptyClientForm() {
  return { name: '', sector: '', status: 'active', scopeOfWork: '', billingAddress: '', contactName: '', contactPhone: '', contactEmail: '', notes: '' }
}

function emptyCameraForm() {
  return { name: '', location: '', model: '', deviceSerial: '', status: 'offline', signal: '—', firmwareVersion: '', firmwareOutOfDate: false }
}

const STATUS_BADGE = { active: 'badge--success', prospect: 'badge--info', inactive: 'badge--neutral' }
const STATUS_LABEL = { active: 'Active', prospect: 'Prospect', inactive: 'Inactive' }
const CAMERA_STATUS_BADGE = { online: 'badge--success', offline: 'badge--neutral' }
const CAMERA_MODAL_TITLE = { nvr: 'Add NVR', edit: 'Edit Camera' }

// Groups a client's flat camera list by deviceSerial: the device-level row
// (channelId null) becomes a card header, its imported channels nest under
// it. Cameras with no deviceSerial get their own singleton group, keyed by
// _id so unrelated standalone cameras never collapse into one group.
function groupCamerasByDevice(cameras) {
  const groups = new Map()
  for (const cam of cameras) {
    const key = cam.deviceSerial || `standalone-${cam._id}`
    if (!groups.has(key)) groups.set(key, { key, deviceSerial: cam.deviceSerial || '', parents: [], channels: [] })
    const group = groups.get(key)
    if (cam.channelId == null) group.parents.push(cam)
    else group.channels.push(cam)
  }
  return [...groups.values()].map(g => ({ ...g, channels: [...g.channels].sort((a, b) => a.channelId - b.channelId) }))
}

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [showEditModal, setShowEditModal] = useState(false)
  const [form, setForm] = useState(emptyClientForm())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const [cameras, setCameras] = useState([])
  const [camerasLoading, setCamerasLoading] = useState(true)
  const [camerasLoadError, setCamerasLoadError] = useState('')

  const [cameraModalKind, setCameraModalKind] = useState(null) // 'nvr' | 'edit' | null
  const [editingCameraId, setEditingCameraId] = useState(null)
  const [cameraForm, setCameraForm] = useState(emptyCameraForm())
  const [cameraError, setCameraError] = useState('')
  const [cameraSaving, setCameraSaving] = useState(false)

  const [confirmCamera, setConfirmCamera] = useState(null)
  const [archivingCamera, setArchivingCamera] = useState(false)
  const [archiveCameraError, setArchiveCameraError] = useState('')

  const [credCamera, setCredCamera] = useState(null)
  const [credForm, setCredForm] = useState({ username: '', password: '' })
  const [credError, setCredError] = useState('')
  const [credSaving, setCredSaving] = useState(false)
  const [credSuccess, setCredSuccess] = useState('')

  const [liveViewCamera, setLiveViewCamera] = useState(null)
  const [liveViewMode, setLiveViewMode] = useState('stream')
  const [liveViewImageUrl, setLiveViewImageUrl] = useState(null)
  const [liveViewNotSetUp, setLiveViewNotSetUp] = useState(false)
  const [liveViewLoading, setLiveViewLoading] = useState(false)
  const [liveViewError, setLiveViewError] = useState('')
  // Tracks the currently-live object URL outside React state so it can be
  // revoked (avoiding a memory leak from creating a new blob URL every poll
  // tick) without racing React 18 StrictMode's dev-mode double-invocation
  // of state updaters.
  const liveViewImageUrlRef = useRef(null)

  const [channelPickerCamera, setChannelPickerCamera] = useState(null)
  const [channelList, setChannelList] = useState([])
  const [channelsLoading, setChannelsLoading] = useState(false)
  const [channelsError, setChannelsError] = useState('')
  const [selectedChannelIds, setSelectedChannelIds] = useState(new Set())
  const [channelNames, setChannelNames] = useState({})
  const [importSaving, setImportSaving] = useState(false)
  const [importError, setImportError] = useState('')

  function loadClient() {
    setLoading(true)
    setLoadError('')
    api.get(`/clients/${id}`).then(setClient).catch(err => setLoadError(err.message)).finally(() => setLoading(false))
  }

  useEffect(loadClient, [id])

  function loadCameras() {
    setCamerasLoading(true)
    setCamerasLoadError('')
    api.get(`/cameras?clientId=${id}`).then(setCameras).catch(err => setCamerasLoadError(err.message)).finally(() => setCamerasLoading(false))
  }

  useEffect(loadCameras, [id])

  function openEditClient() {
    setForm({
      name: client.name, sector: client.sector, status: client.status, scopeOfWork: client.scopeOfWork,
      billingAddress: client.billingAddress, contactName: client.contactName, contactPhone: client.contactPhone,
      contactEmail: client.contactEmail, notes: client.notes,
    })
    setError('')
    setShowEditModal(true)
  }

  async function saveClient(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const updated = await api.put(`/clients/${id}`, form)
      setClient(prev => ({ ...prev, ...updated }))
      setShowEditModal(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteClient() {
    setDeleting(true)
    setDeleteError('')
    try {
      await api.delete(`/clients/${id}`)
      navigate('/clients')
    } catch (err) {
      setDeleteError(`Couldn't delete ${client.name} — ${err.message}. Please try again.`)
    } finally {
      setDeleting(false)
    }
  }

  function openAddNvr() {
    setEditingCameraId(null)
    setCameraForm(emptyCameraForm())
    setCameraError('')
    setCameraModalKind('nvr')
  }

  function openEditCamera(camera) {
    setEditingCameraId(camera._id)
    setCameraForm({
      name: camera.name, location: camera.location, model: camera.model, deviceSerial: camera.deviceSerial || '',
      status: camera.status, signal: camera.signal, firmwareVersion: camera.firmwareVersion || '', firmwareOutOfDate: !!camera.firmwareOutOfDate,
    })
    setCameraError('')
    setCameraModalKind('edit')
  }

  async function saveCamera(e) {
    e.preventDefault()
    setCameraError('')
    setCameraSaving(true)
    try {
      if (editingCameraId) await api.put(`/cameras/${editingCameraId}`, cameraForm)
      else await api.post('/cameras', { ...cameraForm, clientRef: id })
      setCameraModalKind(null)
      loadCameras()
    } catch (err) {
      setCameraError(err.message)
    } finally {
      setCameraSaving(false)
    }
  }

  async function archiveCamera() {
    setArchivingCamera(true)
    setArchiveCameraError('')
    try {
      await api.delete(`/cameras/${confirmCamera._id}`)
      setConfirmCamera(null)
      loadCameras()
    } catch (err) {
      setArchiveCameraError(`Couldn't remove ${confirmCamera.name} — ${err.message}. Please try again.`)
    } finally {
      setArchivingCamera(false)
    }
  }

  function openCredentials(camera) {
    setCredCamera(camera)
    setCredForm({ username: '', password: '' })
    setCredError('')
    setCredSuccess('')
  }

  async function saveCredentials(e) {
    e.preventDefault()
    setCredError('')
    setCredSaving(true)
    try {
      await api.patch(`/cameras/${credCamera._id}/credentials`, credForm)
      setCredSuccess('Credentials saved.')
      setCredForm({ username: '', password: '' })
      loadCameras()
    } catch (err) {
      setCredError(err.message)
    } finally {
      setCredSaving(false)
    }
  }

  // Fetches one fresh frame via the image-proxy route (not the raw Dahua/OSS
  // URL — that object's Content-Type comes back as application/octet-stream,
  // not image/jpeg, so a plain <img src> pointed at it refuses to render;
  // see server/routes/cameras.js's liveViewImageHandler and BUGS_AND_FIXES.md,
  // bug found live 2026-08-03). Fetching as a blob and building an object URL
  // sidesteps that regardless of what header Dahua's storage sends. Using
  // `fetch()` (which only resolves once the full body is downloaded) instead
  // of a bare <img src> also means a fresh frame never partially replaces the
  // visible one — the old frame stays on screen until the new one is fully
  // ready, so a poll tick that's slower than the interval can't leave the
  // image stuck broken.
  //
  // `initial` distinguishes the first open (shows the spinner, surfaces any
  // error) from a background poll tick (silent — a single missed poll must
  // not flash a spinner or blank out an already-showing frame).
  function fetchLiveView(cameraId, { initial } = {}) {
    if (initial) setLiveViewLoading(true)
    fetch(`/api/cameras/${cameraId}/live/image`, { credentials: 'include' })
      .then(async res => {
        if (res.ok) {
          const blob = await res.blob()
          const objectUrl = URL.createObjectURL(blob)
          if (liveViewImageUrlRef.current) URL.revokeObjectURL(liveViewImageUrlRef.current)
          liveViewImageUrlRef.current = objectUrl
          setLiveViewImageUrl(objectUrl)
          setLiveViewNotSetUp(false)
          setLiveViewError('')
          return
        }
        if (res.status === 404) {
          setLiveViewNotSetUp(true)
          setLiveViewError('')
          return
        }
        const body = await res.json().catch(() => null)
        setLiveViewError((body && body.error) || `Request failed (${res.status})`)
      })
      .catch(err => setLiveViewError(err.message))
      .finally(() => { if (initial) setLiveViewLoading(false) })
  }

  // 'stream' (default — real video via LivePlayer) or 'snapshot' (the
  // polling fallback, entered only via LivePlayer's explicit fallback action).
  function openLiveView(camera) {
    setLiveViewCamera(camera)
    setLiveViewMode('stream')
    setLiveViewImageUrl(null)
    setLiveViewNotSetUp(false)
    setLiveViewError('')
  }

  function fallbackToSnapshots() {
    setLiveViewMode('snapshot')
    setLiveViewImageUrl(null)
    setLiveViewNotSetUp(false)
    setLiveViewError('')
    fetchLiveView(liveViewCamera._id, { initial: true })
  }

  useEffect(() => {
    if (!liveViewCamera || liveViewMode !== 'snapshot') return
    const interval = setInterval(() => fetchLiveView(liveViewCamera._id), LIVE_VIEW_POLL_MS)
    return () => {
      clearInterval(interval)
      if (liveViewImageUrlRef.current) {
        URL.revokeObjectURL(liveViewImageUrlRef.current)
        liveViewImageUrlRef.current = null
      }
    }
  }, [liveViewCamera, liveViewMode])

  function openChannelPicker(camera) {
    setChannelPickerCamera(camera)
    setChannelList([])
    setSelectedChannelIds(new Set())
    setChannelNames({})
    setImportError('')
    setChannelsError('')
    setChannelsLoading(true)
    api.get(`/cameras/${camera._id}/channels`).then(data => {
      setChannelList(data.channels)
      setChannelNames(Object.fromEntries(data.channels.map(ch => [ch.channelId, ch.name])))
    }).catch(err => setChannelsError(err.message)).finally(() => setChannelsLoading(false))
  }

  function toggleChannel(channelId) {
    setSelectedChannelIds(prev => {
      const next = new Set(prev)
      if (next.has(channelId)) next.delete(channelId)
      else next.add(channelId)
      return next
    })
  }

  async function submitImportChannels(e) {
    e.preventDefault()
    setImportError('')
    setImportSaving(true)
    try {
      const channels = channelList
        .filter(ch => selectedChannelIds.has(ch.channelId))
        .map(ch => ({ channelId: ch.channelId, name: channelNames[ch.channelId] || ch.name }))
      await api.post(`/cameras/${channelPickerCamera._id}/channels/import`, { channels })
      setChannelPickerCamera(null)
      loadCameras()
    } catch (err) {
      setImportError(err.message)
    } finally {
      setImportSaving(false)
    }
  }

  if (loading) {
    return (
      <div>
        <button className="back-link" onClick={() => navigate('/clients')}><i className="fas fa-arrow-left" /> Back to clients</button>
        <div className="card"><LoadingState /></div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div>
        <button className="back-link" onClick={() => navigate('/clients')}><i className="fas fa-arrow-left" /> Back to clients</button>
        <div className="card">
          <LoadErrorState onRetry={loadClient}>Couldn't load this client — {loadError}.</LoadErrorState>
        </div>
      </div>
    )
  }

  const deviceGroups = groupCamerasByDevice(cameras)
  const isNvrModal = cameraModalKind === 'nvr'

  return (
    <div>
      <button className="back-link" onClick={() => navigate('/clients')}><i className="fas fa-arrow-left" /> Back to clients</button>

      <div className="card">
        <div className="card-title-row">
          <div>
            <div className="client-detail-title">{client.name}</div>
            <div className="client-detail-sub">{client.sector || 'No sector set'} · client since {client.clientSince ? new Date(client.clientSince).getFullYear() : '—'}</div>
          </div>
          <span className={`badge ${STATUS_BADGE[client.status]}`}>{STATUS_LABEL[client.status]}</span>
        </div>

        <div className="drawer-section-label">Scope of Work</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.5, marginBottom: '1.25rem' }}>{client.scopeOfWork || 'Not set'}</div>

        <div className="drawer-stat-row" style={{ marginBottom: '1.25rem' }}>
          <div><div className="drawer-stat-label">Invoices</div><div className="drawer-stat-value">{client.invoiceCount}</div></div>
          <div><div className="drawer-stat-label">Largest Invoice</div><div className="drawer-stat-value">{ZAR(client.largestInvoice)}</div></div>
          <div><div className="drawer-stat-label">Total Invoiced</div><div className="drawer-stat-value">{ZAR(client.totalInvoiced)}</div></div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-ghost" onClick={openEditClient}>Edit Client</button>
          <button className="btn btn-ghost" onClick={() => { setDeleteError(''); setConfirmDelete(true) }}>Delete</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title-row">
          <div className="card-title">Cameras</div>
          <button className="btn btn-primary" onClick={openAddNvr}><i className="fas fa-plus" /> Add NVR</button>
        </div>

        {camerasLoading ? (
          <LoadingState />
        ) : camerasLoadError ? (
          <LoadErrorState onRetry={loadCameras}>Couldn't load cameras — {camerasLoadError}.</LoadErrorState>
        ) : deviceGroups.length === 0 ? (
          <EmptyState actionLabel="Add NVR" onAction={openAddNvr}>
            No cameras yet for this client. Add the client's NVR by its device serial number — its channels (cameras) are pulled in automatically once installed.
          </EmptyState>
        ) : (
          <div className="camera-groups">
            {deviceGroups.map(group => (
              <div className="camera-group-card" key={group.key}>
                {group.parents.map(cam => (
                  <div className="camera-group-header" key={cam._id}>
                    <div className="camera-group-heading">
                      <div className="camera-group-name">{cam.name}</div>
                      <div className="camera-group-meta">
                        {cam.model || 'Unknown model'}{cam.deviceSerial ? ` · Serial ${cam.deviceSerial}` : ''}
                      </div>
                    </div>
                    <div className="camera-group-badges">
                      <span className={`badge ${CAMERA_STATUS_BADGE[cam.status]}`}>{cam.status === 'online' ? 'Online' : 'Offline'}</span>
                      {cam.firmwareVersion && (
                        <span className={`badge ${cam.firmwareOutOfDate ? 'badge--warning' : 'badge--success'}`}>{cam.firmwareOutOfDate ? 'Firmware out of date' : 'Firmware up to date'}</span>
                      )}
                    </div>
                    <div className="table-actions">
                      <button className="btn btn-ghost" onClick={() => openEditCamera(cam)}>Edit</button>
                      <button className="btn btn-ghost" onClick={() => openCredentials(cam)}>Credentials</button>
                      {cam.deviceSerial && (
                        <button className="btn btn-ghost" onClick={() => openChannelPicker(cam)}>Import Channels</button>
                      )}
                      <button className="btn btn-ghost" onClick={() => { setArchiveCameraError(''); setConfirmCamera(cam) }}>Archive</button>
                    </div>
                  </div>
                ))}

                {group.channels.length > 0 && (
                  <div className="camera-channel-table" style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ minWidth: 480 }}>
                      <thead>
                        <tr><th>Channel</th><th>Status</th><th></th></tr>
                      </thead>
                      <tbody>
                        {group.channels.map(cam => (
                          <tr key={cam._id}>
                            <td className="strong">{cam.name}</td>
                            <td><span className={`badge ${CAMERA_STATUS_BADGE[cam.status]}`}>{cam.status === 'online' ? 'Online' : 'Offline'}</span></td>
                            <td>
                              <div className="table-actions">
                                <button className="btn btn-ghost" onClick={() => openLiveView(cam)}>View Live</button>
                                <button className="btn btn-ghost" onClick={() => openEditCamera(cam)}>Edit</button>
                                <button className="btn btn-ghost" onClick={() => { setArchiveCameraError(''); setConfirmCamera(cam) }}>Archive</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete client"
          message={`Delete ${client.name}? They'll no longer appear in your client list. This can't be undone from here.`}
          confirmLabel="Delete"
          busy={deleting}
          error={deleteError}
          onConfirm={deleteClient}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Edit Client</div>
            <form onSubmit={saveClient}>
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
                <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => setShowEditModal(false)}>Cancel</button>
                <SaveButton saving={saving} />
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmCamera && (
        <ConfirmDialog
          title="Archive camera"
          message={`Archive ${confirmCamera.name}? It'll no longer appear for this client.`}
          confirmLabel="Archive"
          busy={archivingCamera}
          error={archiveCameraError}
          onConfirm={archiveCamera}
          onCancel={() => setConfirmCamera(null)}
        />
      )}

      {cameraModalKind && (
        <div className="modal-overlay" onClick={() => setCameraModalKind(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{CAMERA_MODAL_TITLE[cameraModalKind]}</div>
            <form onSubmit={saveCamera}>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="cam-name">Name *</label>
                  <input id="cam-name" required value={cameraForm.name} onChange={e => setCameraForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label htmlFor="cam-serial">Device Serial{isNvrModal ? ' *' : ''}</label>
                  <input id="cam-serial" required={isNvrModal} value={cameraForm.deviceSerial} onChange={e => setCameraForm(f => ({ ...f, deviceSerial: e.target.value }))} placeholder="For Dahua P2P live view" />
                </div>
                {!isNvrModal && (
                  <>
                    <div className="form-field">
                      <label htmlFor="cam-location">Location</label>
                      <input id="cam-location" value={cameraForm.location} onChange={e => setCameraForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Front Gate" />
                    </div>
                    <div className="form-field">
                      <label htmlFor="cam-model">Model</label>
                      <input id="cam-model" value={cameraForm.model} onChange={e => setCameraForm(f => ({ ...f, model: e.target.value }))} />
                    </div>
                    <div className="form-field">
                      <label htmlFor="cam-firmware">Firmware Version</label>
                      <input id="cam-firmware" value={cameraForm.firmwareVersion} onChange={e => setCameraForm(f => ({ ...f, firmwareVersion: e.target.value }))} />
                    </div>
                    <div className="form-field">
                      <label htmlFor="cam-firmware-outdated">
                        <input id="cam-firmware-outdated" type="checkbox" checked={cameraForm.firmwareOutOfDate} onChange={e => setCameraForm(f => ({ ...f, firmwareOutOfDate: e.target.checked }))} style={{ marginRight: '0.4rem' }} />
                        Firmware out of date
                      </label>
                    </div>
                  </>
                )}
              </div>
              {cameraError && <div className="error-banner"><i className="fas fa-exclamation-circle" />{cameraError}</div>}
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" disabled={cameraSaving} onClick={() => setCameraModalKind(null)}>Cancel</button>
                <SaveButton saving={cameraSaving} />
              </div>
            </form>
          </div>
        </div>
      )}

      {credCamera && (
        <div className="modal-overlay" onClick={() => setCredCamera(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">Manage Credentials — {credCamera.name}</div>
            {!credSuccess && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                {credCamera.streamProvider
                  ? 'Credentials are already saved for this camera. Entering new ones replaces them.'
                  : 'No credentials saved yet for this camera.'}
              </p>
            )}
            <form onSubmit={saveCredentials}>
              <div className="form-grid form-grid--single">
                <div className="form-field">
                  <label htmlFor="cred-username">Username *</label>
                  <input id="cred-username" required value={credForm.username} onChange={e => setCredForm(f => ({ ...f, username: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label htmlFor="cred-password">Password *</label>
                  <input id="cred-password" type="password" required value={credForm.password} onChange={e => setCredForm(f => ({ ...f, password: e.target.value }))} />
                </div>
              </div>
              {credError && <div className="error-banner"><i className="fas fa-exclamation-circle" />{credError}</div>}
              {credSuccess && <div className="badge badge--success" style={{ display: 'inline-block', marginTop: '0.5rem' }}>{credSuccess}</div>}
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" disabled={credSaving} onClick={() => setCredCamera(null)}>Close</button>
                <SaveButton saving={credSaving} label="Save Credentials" />
              </div>
            </form>
          </div>
        </div>
      )}

      {liveViewCamera && (
        <div className="modal-overlay" onClick={() => setLiveViewCamera(null)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">Live View — {liveViewCamera.name}</div>
            {liveViewMode === 'stream' ? (
              <LivePlayer cameraId={liveViewCamera._id} onFallbackToSnapshot={fallbackToSnapshots} />
            ) : liveViewLoading ? (
              <LoadingState />
            ) : liveViewImageUrl ? (
              <>
                <img src={liveViewImageUrl} alt={`Live view — ${liveViewCamera.name}`} style={{ width: '100%', borderRadius: 8, background: '#000', display: 'block' }} />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>
                  Refreshes every {LIVE_VIEW_POLL_MS / 1000}s — this is a snapshot, not live video.{' '}
                  <button type="button" className="btn-link" onClick={() => setLiveViewMode('stream')}>Try live stream again</button>
                </p>
                {liveViewError && (
                  <div className="error-banner" style={{ marginTop: '0.5rem' }}>
                    <i className="fas fa-exclamation-circle" />Latest refresh failed — {liveViewError}. Still showing the last frame.
                  </div>
                )}
              </>
            ) : liveViewNotSetUp ? (
              <div className="empty-state" style={{ padding: '1rem 0' }}>
                <div>Live view isn't set up for this camera yet.</div>
              </div>
            ) : (
              <LoadErrorState onRetry={() => fetchLiveView(liveViewCamera._id, { initial: true })}>
                {liveViewError || 'Live view is temporarily unavailable'}.
              </LoadErrorState>
            )}
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setLiveViewCamera(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {channelPickerCamera && (
        <div className="modal-overlay" onClick={() => setChannelPickerCamera(null)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">Import Channels — {channelPickerCamera.name}</div>
            {channelsLoading ? (
              <LoadingState />
            ) : channelsError ? (
              <LoadErrorState onRetry={() => openChannelPicker(channelPickerCamera)}>Couldn't load channels — {channelsError}.</LoadErrorState>
            ) : channelList.length === 0 ? (
              <div className="empty-state" style={{ padding: '1rem 0' }}>
                <div>Dahua reported no channels for this device.</div>
              </div>
            ) : (
              <form onSubmit={submitImportChannels}>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ minWidth: 520 }}>
                    <thead>
                      <tr><th></th><th>Channel</th><th>Status</th><th></th></tr>
                    </thead>
                    <tbody>
                      {channelList.map(ch => (
                        <tr key={ch.channelId}>
                          <td>
                            <input
                              type="checkbox"
                              disabled={ch.alreadyImported}
                              checked={selectedChannelIds.has(ch.channelId)}
                              onChange={() => toggleChannel(ch.channelId)}
                            />
                          </td>
                          <td>
                            <input
                              value={channelNames[ch.channelId] ?? ch.name}
                              disabled={ch.alreadyImported}
                              onChange={e => setChannelNames(n => ({ ...n, [ch.channelId]: e.target.value }))}
                            />
                          </td>
                          <td><span className={`badge ${CAMERA_STATUS_BADGE[ch.status]}`}>{ch.status === 'online' ? 'Online' : 'Offline'}</span></td>
                          <td>{ch.alreadyImported && <span className="badge badge--neutral">Already imported</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importError && <div className="error-banner"><i className="fas fa-exclamation-circle" />{importError}</div>}
                <div className="form-actions">
                  <button type="button" className="btn btn-ghost" disabled={importSaving} onClick={() => setChannelPickerCamera(null)}>Cancel</button>
                  <SaveButton saving={importSaving} label="Import Selected" disabled={selectedChannelIds.size === 0} />
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
