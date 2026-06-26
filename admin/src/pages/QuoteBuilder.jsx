import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/ProtectedRoute'
import QuotePrint from '../components/QuotePrint'
import logo from '../assets/logo.png'
import './QuoteBuilder.css'

const ZAR = n => `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function emptyItem() {
  return { id: Date.now() + Math.random(), description: '', supplierCost: '', qty: 1 }
}

export default function QuoteBuilder() {
  const { user, logout } = useAuth()

  // ── Form state ──────────────────────────────────────────────────────────────
  const [quoteType, setQuoteType] = useState('residential')
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '', address: '', attention: '', emis: '' })
  const [scopeOfWork, setScopeOfWork] = useState('')
  const [selectedPackageId, setSelectedPackageId] = useState('')
  const [items, setItems] = useState([])
  const [travel, setTravel] = useState({ enabled: false, km: '', ratePerKm: '' })
  const [packages, setPackages] = useState([])

  // ── Output state ────────────────────────────────────────────────────────────
  const [breakdown, setBreakdown] = useState(null)
  const [calculating, setCalculating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedQuote, setSavedQuote] = useState(null)
  const [calcError, setCalcError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [showPrint, setShowPrint] = useState(false)

  // ── Load packages on mount ──────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/packages', { credentials: 'include' })
      .then(r => r.json())
      .then(setPackages)
      .catch(() => {})
  }, [])

  // ── Reset on type switch ────────────────────────────────────────────────────
  function switchType(t) {
    setQuoteType(t)
    setSelectedPackageId('')
    setBreakdown(null)
    setSavedQuote(null)
    setCalcError('')
    setSaveError('')
  }

  // ── Item helpers ────────────────────────────────────────────────────────────
  function addItem() { setItems(prev => [...prev, emptyItem()]) }
  function removeItem(id) { setItems(prev => prev.filter(i => i.id !== id)) }
  function updateItem(id, field, value) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  // ── Calculate ───────────────────────────────────────────────────────────────
  async function calculate() {
    setCalcError('')
    setSavedQuote(null)

    const validItems = items.filter(i => i.description && Number(i.supplierCost) > 0)

    if (quoteType === 'residential' && !selectedPackageId && validItems.length === 0) {
      setCalcError('Select a package or add at least one item with a supplier cost.')
      return
    }
    if (quoteType === 'corporate' && validItems.length === 0) {
      setCalcError('Add at least one item with a supplier cost.')
      return
    }

    const body = {
      type: quoteType,
      packageId: selectedPackageId || undefined,
      items: validItems.map(i => ({ description: i.description, supplierCost: Number(i.supplierCost), qty: Number(i.qty) || 1 })),
      travel: travel.enabled && travel.km && travel.ratePerKm
        ? { km: Number(travel.km), ratePerKm: Number(travel.ratePerKm) }
        : undefined,
    }

    setCalculating(true)
    try {
      const res = await fetch('/api/quotes/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setCalcError(data.error || 'Calculation failed'); return }
      setBreakdown(data)
    } catch {
      setCalcError('Could not reach server.')
    } finally {
      setCalculating(false)
    }
  }

  // ── Save quote ──────────────────────────────────────────────────────────────
  async function saveQuote() {
    setSaveError('')
    if (!customer.name.trim() || !customer.phone.trim()) {
      setSaveError('Customer name and phone are required.')
      return
    }
    if (!breakdown) {
      setSaveError('Calculate the quote first.')
      return
    }

    const validItems = items.filter(i => i.description && Number(i.supplierCost) > 0)
    const body = {
      type: quoteType,
      packageId: selectedPackageId || undefined,
      items: validItems.map(i => ({ description: i.description, supplierCost: Number(i.supplierCost), qty: Number(i.qty) || 1 })),
      travel: travel.enabled && travel.km && travel.ratePerKm
        ? { km: Number(travel.km), ratePerKm: Number(travel.ratePerKm) }
        : undefined,
      customerName: customer.name.trim(),
      customerPhone: customer.phone.trim(),
      customerEmail: customer.email.trim() || undefined,
    }

    setSaving(true)
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setSaveError(data.error || 'Save failed'); return }
      setSavedQuote(data)
    } catch {
      setSaveError('Could not reach server.')
    } finally {
      setSaving(false)
    }
  }

  const selectedPkg = packages.find(p => p._id === selectedPackageId)

  return (
    <div className="qb-page">
      {/* Header */}
      <header className="qb-header">
        <div className="qb-header__brand">
          <img src={logo} alt="Mashtronics" className="qb-header__logo" />
          ADMIN
        </div>
        <nav className="qb-header__nav">
          <span className="qb-nav-link qb-nav-link--active"><i className="fas fa-file-invoice-dollar" /> Quote Builder</span>
          <Link to="/chat-questions" className="qb-nav-link"><i className="fas fa-comments" /> Chat Questions</Link>
        </nav>
        <div className="qb-header__right">
          {user && <span className="qb-header__user"><i className="fas fa-user-circle" /> {user.username}</span>}
          <button className="btn btn-ghost" style={{ padding: '0.4rem 0.9rem', color: 'white', borderColor: 'rgba(255,255,255,0.4)' }} onClick={logout}>
            <i className="fas fa-sign-out-alt" /> Logout
          </button>
        </div>
      </header>

      <div className="qb-body">
        {/* ── LEFT PANEL ── */}
        <div>
          {/* Customer */}
          <div className="qb-card">
            <div className="qb-section-title"><i className="fas fa-user" /> Customer</div>
            <div className="qb-field">
              <label htmlFor="cust-name">Company / Name *</label>
              <input id="cust-name" type="text" value={customer.name} onChange={e => setCustomer(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Mashamba Presidential School" />
            </div>
            <div className="qb-field">
              <label htmlFor="cust-address">Address</label>
              <textarea
                id="cust-address"
                rows={2}
                value={customer.address}
                onChange={e => setCustomer(p => ({ ...p, address: e.target.value }))}
                placeholder="Street / village / suburb"
              />
            </div>
            <div className="qb-row">
              <div className="qb-field">
                <label htmlFor="cust-attention">Attention / Contact Person</label>
                <input id="cust-attention" type="text" value={customer.attention} onChange={e => setCustomer(p => ({ ...p, attention: e.target.value }))} placeholder="e.g. Mr Smith" />
              </div>
              <div className="qb-field">
                <label htmlFor="cust-emis">Ref / EMIS No</label>
                <input id="cust-emis" type="text" value={customer.emis} onChange={e => setCustomer(p => ({ ...p, emis: e.target.value }))} placeholder="optional" />
              </div>
            </div>
            <div className="qb-row">
              <div className="qb-field">
                <label htmlFor="cust-phone">Phone *</label>
                <input id="cust-phone" type="text" value={customer.phone} onChange={e => setCustomer(p => ({ ...p, phone: e.target.value }))} placeholder="011 765 4148" />
              </div>
              <div className="qb-field">
                <label htmlFor="cust-email">Email</label>
                <input id="cust-email" type="email" value={customer.email} onChange={e => setCustomer(p => ({ ...p, email: e.target.value }))} placeholder="optional" />
              </div>
            </div>
          </div>

          {/* Scope of work */}
          <div className="qb-card">
            <div className="qb-section-title"><i className="fas fa-clipboard-list" /> Scope of Work</div>
            <div className="qb-field" style={{ marginBottom: 0 }}>
              <textarea
                rows={2}
                value={scopeOfWork}
                onChange={e => setScopeOfWork(e.target.value)}
                placeholder="e.g. Supply, install, configure and commission 4 channel IP CCTV system"
              />
            </div>
          </div>

          {/* Quote type */}
          <div className="qb-card">
            <div className="qb-section-title"><i className="fas fa-file-invoice-dollar" /> Quote Type</div>
            <div className="qb-type-toggle">
              <button className={quoteType === 'residential' ? 'active' : ''} onClick={() => switchType('residential')}>
                <i className="fas fa-home" /> Residential
              </button>
              <button className={quoteType === 'corporate' ? 'active' : ''} onClick={() => switchType('corporate')}>
                <i className="fas fa-building" /> Corporate
              </button>
            </div>

            {/* Package dropdown — residential only */}
            {quoteType === 'residential' && (
              <div className="qb-field" style={{ marginTop: '1.1rem' }}>
                <label htmlFor="pkg-select">CCTV Package (optional)</label>
                <select
                  id="pkg-select"
                  className="qb-package-select"
                  value={selectedPackageId}
                  onChange={e => {
                    setSelectedPackageId(e.target.value)
                    setBreakdown(null)
                    setSavedQuote(null)
                    const pkg = packages.find(p => p._id === e.target.value)
                    if (pkg?.cameraCount) {
                      setScopeOfWork(`Supply, install, configure and commission ${pkg.cameraCount} channel IP CCTV system`)
                    }
                  }}
                >
                  <option value="">— None / custom items only —</option>
                  {packages
                    .filter(p => p.category === 'residential')
                    .map(p => (
                      <option key={p._id} value={p._id}>
                        {p.name} — {ZAR(p.priceInclVAT)} (incl VAT)
                      </option>
                    ))
                  }
                </select>
              </div>
            )}
          </div>

          {/* Custom items */}
          <div className="qb-card">
            <div className="qb-section-title"><i className="fas fa-list" /> Custom Items</div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', marginBottom: '0.85rem' }}>
              {quoteType === 'residential'
                ? 'Add items using residential pricing (20% markup + 30% install, min R3,000).'
                : 'Corporate pricing applied: 35% markup + 30% install, min R5,000.'}
            </p>

            {items.length > 0 && (
              <>
                <div className="qb-item-headers">
                  <span>Description</span><span>Qty</span><span>Cost (R excl)</span><span />
                </div>
                <div className="qb-items-list">
                  {items.map(item => (
                    <div key={item.id} className="qb-item-row">
                      <input
                        type="text"
                        value={item.description}
                        onChange={e => updateItem(item.id, 'description', e.target.value)}
                        placeholder="e.g. IP Camera"
                      />
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={e => updateItem(item.id, 'qty', e.target.value)}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.supplierCost}
                        onChange={e => updateItem(item.id, 'supplierCost', e.target.value)}
                        placeholder="0.00"
                      />
                      <button className="qb-item-remove" onClick={() => removeItem(item.id)} title="Remove item">
                        <i className="fas fa-times" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <button className="btn btn-ghost" onClick={addItem}>
              <i className="fas fa-plus" /> Add Item
            </button>
          </div>

          {/* Travel */}
          <div className="qb-card">
            <div className="qb-section-title"><i className="fas fa-car" /> Travel</div>
            <label className="qb-travel-toggle">
              <input
                type="checkbox"
                checked={travel.enabled}
                onChange={e => { setTravel(p => ({ ...p, enabled: e.target.checked })); setBreakdown(null); setSavedQuote(null) }}
              />
              Include travel charge
            </label>

            {travel.enabled && (
              <div className="qb-travel-fields">
                <div className="qb-field">
                  <label htmlFor="travel-km">Distance (km)</label>
                  <input
                    id="travel-km"
                    type="number"
                    min="0"
                    step="1"
                    value={travel.km}
                    onChange={e => setTravel(p => ({ ...p, km: e.target.value }))}
                    placeholder="e.g. 25"
                  />
                </div>
                <div className="qb-field">
                  <label htmlFor="travel-rate">Rate (R/km)</label>
                  <input
                    id="travel-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={travel.ratePerKm}
                    onChange={e => setTravel(p => ({ ...p, ratePerKm: e.target.value }))}
                    placeholder="e.g. 5.50"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="qb-summary">
          <div className="qb-card">
            <div className="qb-section-title"><i className="fas fa-receipt" /> Quote Summary</div>

            {!breakdown ? (
              <p className="qb-summary-empty">Fill in the form and click <strong>Calculate</strong> to see the breakdown.</p>
            ) : (
              <div className="qb-breakdown">
                {/* Package section */}
                {breakdown.packageBreakdown && (
                  <div className="qb-breakdown-section">
                    <div className="qb-breakdown-section-title">Package</div>
                    <div className="qb-line"><span>{breakdown.packageBreakdown.name}</span><span>{ZAR(breakdown.packageBreakdown.total)}</span></div>
                    <div className="qb-line sub"><span>excl VAT</span><span>{ZAR(breakdown.packageBreakdown.exclVAT)}</span></div>
                    <div className="qb-line sub"><span>VAT (15%)</span><span>{ZAR(breakdown.packageBreakdown.vatAmount)}</span></div>
                  </div>
                )}

                {/* Custom items section */}
                {breakdown.itemsBreakdown && (
                  <div className="qb-breakdown-section">
                    <div className="qb-breakdown-section-title">Custom Items</div>
                    <div className="qb-line"><span>Materials (marked up)</span><span>{ZAR(breakdown.itemsBreakdown.markedUp)}</span></div>
                    <div className="qb-line"><span>Installation</span><span>{ZAR(breakdown.itemsBreakdown.installation)}</span></div>
                    <div className="qb-line sub"><span>VAT on items</span><span>{ZAR(breakdown.itemsBreakdown.vatAmount)}</span></div>
                  </div>
                )}

                {/* Travel section */}
                {breakdown.travelBreakdown && (
                  <div className="qb-breakdown-section">
                    <div className="qb-breakdown-section-title">
                      Travel ({breakdown.travelBreakdown.km} km × R{breakdown.travelBreakdown.ratePerKm}/km)
                    </div>
                    <div className="qb-line"><span>Travel excl VAT</span><span>{ZAR(breakdown.travelBreakdown.travelExcl)}</span></div>
                    <div className="qb-line sub"><span>VAT on travel</span><span>{ZAR(breakdown.travelBreakdown.travelVAT)}</span></div>
                  </div>
                )}

                {/* Grand total */}
                <div className="qb-divider" />
                <div className="qb-line"><span style={{ fontWeight: 600 }}>Subtotal (excl VAT)</span><span>{ZAR(breakdown.grand.subtotal)}</span></div>
                <div className="qb-line"><span style={{ fontWeight: 600 }}>VAT (15%)</span><span>{ZAR(breakdown.grand.vatAmount)}</span></div>
                <div className="qb-divider" />
                <div className="qb-grand">
                  <span className="qb-grand__label">GRAND TOTAL</span>
                  <span className="qb-grand__amount">{ZAR(breakdown.grand.total)}</span>
                </div>
                <div className="qb-vat-note">VAT No. 4320284435</div>
                <div className="qb-disclaimer">Estimate only — subject to site inspection</div>
              </div>
            )}

            {calcError && (
              <div className="qb-error"><i className="fas fa-exclamation-circle" />{calcError}</div>
            )}

            {/* Actions */}
            <div className="qb-actions">
              <button className="btn btn-primary" onClick={calculate} disabled={calculating}>
                {calculating ? <><i className="fas fa-spinner fa-spin" /> Calculating…</> : <><i className="fas fa-calculator" /> Calculate</>}
              </button>
              <button
                className="btn btn-accent"
                onClick={saveQuote}
                disabled={saving || !breakdown || !!savedQuote}
                title={!breakdown ? 'Calculate first' : ''}
              >
                {saving ? <><i className="fas fa-spinner fa-spin" /> Saving…</> : <><i className="fas fa-save" /> Save Quote</>}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setShowPrint(true)}
                disabled={!breakdown}
                title={!breakdown ? 'Calculate first' : 'Preview & print quote'}
              >
                <i className="fas fa-print" /> Print Quote
              </button>
            </div>

            {saveError && (
              <div className="qb-error"><i className="fas fa-exclamation-circle" />{saveError}</div>
            )}

            {savedQuote && (
              <div className="qb-saved">
                <i className="fas fa-check-circle" />
                Saved as <strong>{savedQuote.quoteNumber}</strong> — Total {ZAR(savedQuote.total)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Print overlay ── */}
      {showPrint && (
        <QuotePrint
          customer={customer}
          scopeOfWork={scopeOfWork}
          breakdown={breakdown}
          savedQuote={savedQuote}
          selectedPkg={selectedPkg}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}
