import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './ProtectedRoute'
import logo from '../assets/logo.png'
import './AppShell.css'

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'fa-gauge-high', end: true },
  { to: '/clients', label: 'Clients', icon: 'fa-users' },
  { to: '/messages', label: 'Messages', icon: 'fa-message' },
  { to: '/quotes', label: 'Quotes', icon: 'fa-file-invoice-dollar' },
  { to: '/jobs', label: 'Jobs', icon: 'fa-clipboard-check' },
  { to: '/invoicing', label: 'Invoicing', icon: 'fa-receipt' },
  { to: '/scheduling', label: 'Scheduling', icon: 'fa-calendar-days' },
  { to: '/maintenance', label: 'Maintenance', icon: 'fa-screwdriver-wrench' },
  { to: '/compliance', label: 'Compliance', icon: 'fa-shield-halved' },
  { to: '/client-files', label: 'Client Files', icon: 'fa-folder-open' },
  { to: '/technicians', label: 'Technicians', icon: 'fa-user-gear' },
  { to: '/response-officers', label: 'Armed Response', icon: 'fa-user-shield' },
  { to: '/device-binds', label: 'Device Binds', icon: 'fa-video' },
  { to: '/chat-questions', label: 'Chat Questions', icon: 'fa-comments' },
]

const PAGE_META = [
  { match: /^\/$/, title: 'Dashboard', subtitle: 'Business overview and key numbers' },
  { match: /^\/clients\/[^/]+$/, title: 'Client Detail', subtitle: 'Scope of work, invoicing and cameras for this client' },
  { match: /^\/clients/, title: 'Clients', subtitle: 'Client records, scope of work and status' },
  { match: /^\/messages/, title: 'Messages', subtitle: 'Live client conversations — AI-assisted and escalated' },
  { match: /^\/quotes\/(new|.+\/edit)/, title: 'Quote Builder', subtitle: 'Auto-priced or sectioned — totals update live' },
  { match: /^\/quotes/, title: 'Quotes', subtitle: 'Track quote follow-ups and conversion' },
  { match: /^\/jobs/, title: 'Jobs', subtitle: 'Work orders across all active sites' },
  { match: /^\/invoicing/, title: 'Invoicing', subtitle: 'Payment status and outstanding balances' },
  { match: /^\/scheduling/, title: 'Scheduling', subtitle: 'Technician assignments for the week' },
  { match: /^\/maintenance/, title: 'Maintenance', subtitle: 'Recurring contract visits' },
  { match: /^\/compliance/, title: 'Compliance', subtitle: 'B-BBEE, PSiRA and insurance status' },
  { match: /^\/client-files/, title: 'Client Files', subtitle: 'Quotes, invoices and contracts per client' },
  { match: /^\/technicians/, title: 'Technicians', subtitle: 'Field technician roster' },
  { match: /^\/response-officers/, title: 'Armed Response', subtitle: 'Armed-response officer roster' },
  { match: /^\/device-binds/, title: 'Device Binds', subtitle: 'Dahua devices shared to the ARC account, awaiting client assignment' },
  { match: /^\/chat-questions/, title: 'Chat Questions', subtitle: 'Questions captured by the site chatbot' },
]

function pageMetaFor(pathname) {
  return PAGE_META.find(p => p.match.test(pathname)) || { title: '', subtitle: '' }
}

export default function AppShell() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const { title, subtitle } = pageMetaFor(location.pathname)

  return (
    <div className="shell">
      <aside className="shell-sidebar">
        <div className="shell-logo-box">
          <img src={logo} alt="Mashtronics" className="shell-logo" />
        </div>
        <nav className="shell-nav">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => 'shell-nav-link' + (isActive ? ' shell-nav-link--active' : '')}
            >
              <i className={`fas ${item.icon}`} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        {user && (
          <div className="shell-sidebar-footer">
            <div className="shell-avatar">{(user.username || '?').slice(0, 2).toUpperCase()}</div>
            <div>
              <div className="shell-user-name">{user.username}</div>
              <div className="shell-user-role">{user.role || 'admin'}</div>
            </div>
          </div>
        )}
      </aside>

      <div className="shell-main">
        <header className="shell-topbar">
          <div>
            <div className="shell-topbar-title">{title}</div>
            <div className="shell-topbar-subtitle">{subtitle}</div>
          </div>
          <button className="btn btn-ghost" onClick={logout}>
            <i className="fas fa-sign-out-alt" /> Logout
          </button>
        </header>
        <main className="shell-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
