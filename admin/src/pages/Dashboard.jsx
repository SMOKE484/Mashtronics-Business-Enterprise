import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ZAR } from '../api'
import { LoadingState, LoadErrorState } from '../components/PageState'
import './Dashboard.css'

export default function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const navigate = useNavigate()

  function load() {
    setLoading(true)
    setLoadError('')
    api.get('/dashboard/summary').then(setSummary).catch(err => setLoadError(err.message)).finally(() => setLoading(false))
  }

  useEffect(load, [])

  if (loading) return <div className="card"><LoadingState /></div>
  if (loadError || !summary) {
    return (
      <div className="card">
        <LoadErrorState onRetry={load}>
          Couldn't load the dashboard — {loadError || 'no data came back from the server'}.
        </LoadErrorState>
      </div>
    )
  }

  const { kpis, revenueByYear, topClients, complianceAlerts, recentActivity, dahuaPendingBinds = [], dahuaPendingBindsCount = 0 } = summary
  const maxRevenue = Math.max(1, ...revenueByYear.map(r => r.revenue))
  const currentYear = new Date().getFullYear()

  return (
    <div>
      {complianceAlerts.length > 0 && (
        <div className="dash-banner">
          <i className="fas fa-triangle-exclamation" />
          <div>
            <div className="dash-banner-title">{complianceAlerts.length} compliance document(s) need attention</div>
            <div className="dash-banner-text">{complianceAlerts.map(a => `${a.name} (${a.status.toLowerCase()})`).join('  •  ')}</div>
          </div>
          <button className="dash-banner-link" onClick={() => navigate('/compliance')}>Review →</button>
        </div>
      )}

      {dahuaPendingBindsCount > 0 && (
        <div className="dash-banner">
          <i className="fas fa-video" />
          <div>
            <div className="dash-banner-title">{dahuaPendingBindsCount} device{dahuaPendingBindsCount === 1 ? '' : 's'} waiting to be assigned to a client</div>
            <div className="dash-banner-text">{dahuaPendingBinds.map(b => b.deviceSerial).join('  •  ')}</div>
          </div>
          <button className="dash-banner-link" onClick={() => navigate('/device-binds')}>Review →</button>
        </div>
      )}

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Invoiced (all-time)</div>
          <div className="kpi-value">{ZAR(kpis.totalInvoiced)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{currentYear} Revenue</div>
          <div className="kpi-value">{ZAR(kpis.currentYearRevenue)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Outstanding Invoices</div>
          <div className="kpi-value kpi-value--danger">{ZAR(kpis.outstandingTotal)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Active Jobs</div>
          <div className="kpi-value">{kpis.activeJobsCount}</div>
          <div className="kpi-foot">Across {kpis.technicianCount} field technician{kpis.technicianCount === 1 ? '' : 's'}</div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-title">Revenue by Year</div>
          {revenueByYear.length === 0 ? (
            <div className="empty-state">No invoices yet — revenue will appear here once invoices are issued.</div>
          ) : (
            <div className="dash-chart">
              {revenueByYear.map(bar => (
                <div key={bar.year} className="dash-bar-col">
                  <div className="dash-bar-value">{ZAR(bar.revenue)}</div>
                  <div className="dash-bar-track">
                    <div className="dash-bar" style={{ height: `${Math.max(3, Math.round((bar.revenue / maxRevenue) * 100))}%` }} />
                  </div>
                  <div className="dash-bar-year">{bar.year}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">Recent Activity</div>
          {recentActivity.length === 0 ? (
            <div className="empty-state">Nothing recorded yet.</div>
          ) : (
            <div className="dash-activity-list">
              {recentActivity.map((a, i) => (
                <div key={i} className="dash-activity-row">
                  <div className="dash-activity-dot" />
                  <div>
                    <div className="dash-activity-title">{a.title}</div>
                    <div className="dash-activity-time">{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.25rem' }}>
        <div className="card-title">Revenue by Major Client</div>
        {topClients.length === 0 ? (
          <div className="empty-state">No invoiced revenue yet.</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Client</th><th>Invoices</th><th>Largest Invoice</th><th>Total Invoiced</th></tr></thead>
            <tbody>
              {topClients.map(c => (
                <tr key={c._id}>
                  <td className="strong">{c.name}</td>
                  <td>{c.invoiceCount}</td>
                  <td>{ZAR(c.largestInvoice)}</td>
                  <td>{ZAR(c.totalInvoiced)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
