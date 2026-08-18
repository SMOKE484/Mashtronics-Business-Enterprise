import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ZAR } from '../api'
import { LoadingState, LoadErrorState, EmptyState } from '../components/PageState'

export default function ClientFiles() {
  const [clients, setClients] = useState([])
  const [quotes, setQuotes] = useState([])
  const [invoices, setInvoices] = useState([])
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [activeClientId, setActiveClientId] = useState(null)
  const navigate = useNavigate()

  function load() {
    if (!clients.length) setLoading(true)
    setLoadError('')
    Promise.all([api.get('/clients'), api.get('/quotes'), api.get('/invoices'), api.get('/maintenance')])
      .then(([c, q, i, m]) => { setClients(c); setQuotes(q); setInvoices(i); setContracts(m) })
      .catch(err => setLoadError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function docsFor(clientId) {
    const quoteDocs = quotes
      .filter(q => (q.clientRef?._id || q.clientRef) === clientId)
      .map(q => ({ id: q._id, name: `${q.quoteNumber} — ${q.scopeOfWork || 'Quote'}`, type: 'Quote', date: q.quoteDate || q.createdAt, amount: ZAR(q.total), canOpen: true }))
    const invoiceDocs = invoices
      .filter(i => (i.clientRef?._id || i.clientRef) === clientId)
      .map(i => ({ id: i._id, name: i.invoiceNumber, type: 'Invoice', date: i.issuedDate, amount: ZAR(i.amount), canOpen: false }))
    const contractDocs = contracts
      .filter(c => (c.clientRef?._id || c.clientRef) === clientId)
      .map(c => ({ id: c._id, name: c.service, type: 'Contract', date: c.contractSince, amount: '—', canOpen: false }))
    return [...quoteDocs, ...invoiceDocs, ...contractDocs].sort((a, b) => new Date(b.date) - new Date(a.date))
  }

  const activeClient = clients.find(c => c._id === activeClientId)

  if (loading) return <div className="card"><LoadingState /></div>
  if (loadError) {
    return (
      <div className="card">
        <LoadErrorState onRetry={load}>Couldn't load client files — {loadError}.</LoadErrorState>
      </div>
    )
  }

  if (activeClient) {
    const docs = docsFor(activeClient._id)
    return (
      <div>
        <button className="btn btn-ghost" style={{ marginBottom: '1rem' }} onClick={() => setActiveClientId(null)}>
          <i className="fas fa-arrow-left" /> Back to all client files
        </button>
        <div className="card">
          <div className="card-title">{activeClient.name}</div>
          {docs.length === 0 ? (
            <div className="empty-state">No documents saved for this client yet.</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Document</th><th>Type</th><th>Date</th><th>Amount</th><th></th></tr></thead>
              <tbody>
                {docs.map(d => (
                  <tr key={d.type + d.id}>
                    <td className="strong">{d.name}</td>
                    <td><span className={`badge ${d.type === 'Quote' ? 'badge--info' : d.type === 'Invoice' ? 'badge--success' : 'badge--neutral'}`}>{d.type}</span></td>
                    <td>{new Date(d.date).toLocaleDateString('en-ZA')}</td>
                    <td>{d.amount}</td>
                    <td>{d.canOpen && <button className="btn btn-ghost" onClick={() => navigate(`/quotes/${d.id}/edit`)}>Open →</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
      {clients.map(c => (
        <div key={c._id} className="card" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.85rem' }} onClick={() => setActiveClientId(c._id)}>
          <i className="fas fa-folder-open" style={{ fontSize: '1.6rem', color: 'var(--info)' }} />
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>{c.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>{docsFor(c._id).length} document(s)</div>
          </div>
        </div>
      ))}
      {clients.length === 0 && (
        <div className="card">
          <EmptyState actionLabel="Go to Clients" onAction={() => navigate('/clients')}>
            No clients yet — add a client first, and their quotes, invoices and contracts will be filed here.
          </EmptyState>
        </div>
      )}
    </div>
  )
}
