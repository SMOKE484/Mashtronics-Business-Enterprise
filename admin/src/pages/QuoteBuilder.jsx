import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../components/ProtectedRoute'
import { api, ZAR } from '../api'
import { calcLineTotal, calcSectionSubtotal, calcManualQuoteTotals } from '../utils/quoteCalc'
import { LoadingState, LoadErrorState, ActionErrorBanner } from '../components/PageState'
import QuotePrint from '../components/QuotePrint'
import './QuoteBuilder.css'

const CATALOG = [
  { desc: 'IP Dome Camera 4MP (supply & install)', unit: 3450 },
  { desc: 'NVR 16-channel with 4TB storage', unit: 12800 },
  { desc: 'CAT6 cabling per meter (installed)', unit: 38 },
  { desc: 'Biometric access reader', unit: 5200 },
  { desc: 'Labour — technician per hour', unit: 450 },
]

function newLine(overrides = {}) {
  return { id: Date.now() + Math.random(), description: '', detail: '', qty: 1, unit: 'Item', unitPrice: 0, discountPct: 0, ...overrides }
}

function newSection(title = 'New Section') {
  return { id: Date.now() + Math.random(), title, items: [newLine()] }
}

function newCustomItem() {
  return { id: Date.now() + Math.random(), description: '', supplierCost: '', qty: 1 }
}

// ── Manual/sectioned editor ───────────────────────────────────────────────────
function SectionedEditor({ sections, setSections }) {
  function addSection() {
    setSections(prev => [...prev, newSection()])
  }
  function removeSection(secId) {
    setSections(prev => prev.length > 1 ? prev.filter(s => s.id !== secId) : prev)
  }
  function setSectionTitle(secId, title) {
    setSections(prev => prev.map(s => s.id === secId ? { ...s, title } : s))
  }
  function addLine(secId) {
    setSections(prev => prev.map(s => s.id === secId ? { ...s, items: [...s.items, newLine()] } : s))
  }
  function removeLine(secId, lineId) {
    setSections(prev => prev.map(s => s.id === secId ? { ...s, items: s.items.length > 1 ? s.items.filter(l => l.id !== lineId) : s.items } : s))
  }
  function updateLine(secId, lineId, field, value) {
    setSections(prev => prev.map(s => s.id === secId ? {
      ...s, items: s.items.map(l => l.id === lineId ? { ...l, [field]: value } : l),
    } : s))
  }
  function quickAdd(catalogItem) {
    setSections(prev => prev.map((s, i) => i === 0
      ? { ...s, items: [...s.items, newLine({ description: catalogItem.desc, unitPrice: catalogItem.unit })] }
      : s))
  }

  return (
    <>
      <div className="qb-chip-row">
        <span className="qb-chip-row__label">Quick add to Section 1</span>
        {CATALOG.map((c, i) => (
          <button key={i} type="button" className="qb-chip" onClick={() => quickAdd(c)}>+ {c.desc}</button>
        ))}
      </div>

      <div className="qb-sheet-head">
        <div>Item</div><div>Description</div><div className="qb-right">Qty</div><div>Unit</div>
        <div className="qb-right">Unit Price</div><div className="qb-right">Disc%</div><div className="qb-right">Total</div><div />
      </div>

      {sections.map((sec, si) => (
        <div key={sec.id}>
          <div className="qb-section-row">
            <span className="qb-section-row__num">SECTION {si + 1}:</span>
            <input className="qb-section-row__title" value={sec.title} onChange={e => setSectionTitle(sec.id, e.target.value)} />
            <button type="button" className="qb-section-row__add" onClick={() => addLine(sec.id)}>+ Add line</button>
            {sections.length > 1 && (
              <button type="button" className="qb-section-row__add" onClick={() => removeSection(sec.id)}>Remove section</button>
            )}
          </div>
          {sec.items.map((line, li) => (
            <div key={line.id} className="qb-line-row">
              <div className="qb-line-row__no">{si + 1}.{li + 1}</div>
              <div className="qb-line-row__desc">
                <input value={line.description} onChange={e => updateLine(sec.id, line.id, 'description', e.target.value)} placeholder="Item description" />
                <textarea rows={1} value={line.detail} onChange={e => updateLine(sec.id, line.id, 'detail', e.target.value)} placeholder="Additional notes (optional)" />
              </div>
              <div className="qb-line-row__num"><input type="number" value={line.qty} onChange={e => updateLine(sec.id, line.id, 'qty', e.target.value)} /></div>
              <div className="qb-line-row__num">
                <select value={line.unit} onChange={e => updateLine(sec.id, line.id, 'unit', e.target.value)}>
                  <option>Item</option><option>each</option><option>m</option><option>hr</option><option>Lot</option><option>Sum</option><option>N/A</option>
                </select>
              </div>
              <div className="qb-line-row__num"><input type="number" value={line.unitPrice} onChange={e => updateLine(sec.id, line.id, 'unitPrice', e.target.value)} /></div>
              <div className="qb-line-row__num"><input type="number" value={line.discountPct} onChange={e => updateLine(sec.id, line.id, 'discountPct', e.target.value)} /></div>
              <div className="qb-line-row__total">{ZAR(calcLineTotal(line))}</div>
              <div className="qb-line-row__del"><button type="button" onClick={() => removeLine(sec.id, line.id)}>&times;</button></div>
            </div>
          ))}
          <div className="qb-subtotal-row">
            <span>Sub-Total for Section {si + 1}</span>
            <span>{ZAR(calcSectionSubtotal(sec.items))}</span>
          </div>
        </div>
      ))}

      <button type="button" className="btn btn-ghost" style={{ marginTop: '0.75rem' }} onClick={addSection}>+ Add section</button>
    </>
  )
}

// ── Auto-priced editor (pricing engine) ───────────────────────────────────────
function AutoModeEditor({
  packages, quoteType, setQuoteType, selectedPackageId, setSelectedPackageId,
  items, setItems, travel, setTravel, breakdown, calculating, calcError, onCalculate,
}) {
  function addItem() { setItems(prev => [...prev, newCustomItem()]) }
  function removeItem(id) { setItems(prev => prev.filter(i => i.id !== id)) }
  function updateItem(id, field, value) { setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i)) }

  return (
    <div>
      <div className="qb-type-toggle">
        <button type="button" className={quoteType === 'residential' ? 'active' : ''} onClick={() => setQuoteType('residential')}>
          <i className="fas fa-home" /> Residential
        </button>
        <button type="button" className={quoteType === 'corporate' ? 'active' : ''} onClick={() => setQuoteType('corporate')}>
          <i className="fas fa-building" /> Corporate
        </button>
      </div>

      {quoteType === 'residential' && (
        <div className="qb-field" style={{ marginTop: '1rem' }}>
          <label htmlFor="pkg-select">CCTV Package (optional)</label>
          <select id="pkg-select" value={selectedPackageId} onChange={e => setSelectedPackageId(e.target.value)}>
            <option value="">— None / custom items only —</option>
            {packages.filter(p => p.category === 'residential').map(p => (
              <option key={p._id} value={p._id}>{p.name} — {ZAR(p.priceInclVAT)} (incl VAT)</option>
            ))}
          </select>
        </div>
      )}

      <div style={{ marginTop: '1.25rem' }}>
        <div className="qb-field-label">Custom Items</div>
        {items.length > 0 && (
          <>
            <div className="qb-item-headers"><span>Description</span><span>Qty</span><span>Cost (R excl)</span><span /></div>
            <div className="qb-items-list">
              {items.map(item => (
                <div key={item.id} className="qb-item-row">
                  <input value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} placeholder="e.g. IP Camera" />
                  <input type="number" min="1" value={item.qty} onChange={e => updateItem(item.id, 'qty', e.target.value)} />
                  <input type="number" min="0" step="0.01" value={item.supplierCost} onChange={e => updateItem(item.id, 'supplierCost', e.target.value)} placeholder="0.00" />
                  <button type="button" className="qb-item-remove" onClick={() => removeItem(item.id)}><i className="fas fa-times" /></button>
                </div>
              ))}
            </div>
          </>
        )}
        <button type="button" className="btn btn-ghost" onClick={addItem}><i className="fas fa-plus" /> Add Item</button>
      </div>

      <div style={{ marginTop: '1.25rem' }}>
        <label className="qb-travel-toggle">
          <input type="checkbox" checked={travel.enabled} onChange={e => setTravel(p => ({ ...p, enabled: e.target.checked }))} />
          Include travel charge
        </label>
        {travel.enabled && (
          <div className="qb-travel-fields">
            <div className="qb-field">
              <label htmlFor="travel-km">Distance (km)</label>
              <input id="travel-km" type="number" min="0" value={travel.km} onChange={e => setTravel(p => ({ ...p, km: e.target.value }))} />
            </div>
            <div className="qb-field">
              <label htmlFor="travel-rate">Rate (R/km)</label>
              <input id="travel-rate" type="number" min="0" step="0.01" value={travel.ratePerKm} onChange={e => setTravel(p => ({ ...p, ratePerKm: e.target.value }))} />
            </div>
          </div>
        )}
      </div>

      <button type="button" className="btn btn-primary" style={{ marginTop: '1.25rem' }} onClick={onCalculate} disabled={calculating}>
        {calculating ? <><i className="fas fa-spinner fa-spin" /> Calculating…</> : <><i className="fas fa-calculator" /> Calculate</>}
      </button>
      {calcError && <div className="error-banner"><i className="fas fa-exclamation-circle" />{calcError}</div>}

      {breakdown && (
        <div className="qb-breakdown">
          {breakdown.packageBreakdown && (
            <div className="qb-breakdown-section">
              <div className="qb-breakdown-section-title">Package</div>
              <div className="qb-line"><span>{breakdown.packageBreakdown.name}</span><span>{ZAR(breakdown.packageBreakdown.total)}</span></div>
            </div>
          )}
          {breakdown.itemsBreakdown && (
            <div className="qb-breakdown-section">
              <div className="qb-breakdown-section-title">Custom Items</div>
              <div className="qb-line"><span>Materials (marked up)</span><span>{ZAR(breakdown.itemsBreakdown.markedUp)}</span></div>
              <div className="qb-line"><span>Installation</span><span>{ZAR(breakdown.itemsBreakdown.installation)}</span></div>
            </div>
          )}
          {breakdown.travelBreakdown && (
            <div className="qb-breakdown-section">
              <div className="qb-breakdown-section-title">Travel ({breakdown.travelBreakdown.km} km × R{breakdown.travelBreakdown.ratePerKm}/km)</div>
              <div className="qb-line"><span>Travel excl VAT</span><span>{ZAR(breakdown.travelBreakdown.travelExcl)}</span></div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main container ─────────────────────────────────────────────────────────
export default function QuoteBuilder() {
  const { user } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()

  const [clients, setClients] = useState([])
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(!!id)
  const [quote, setQuote] = useState(null) // the persisted quote, once saved/loaded
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false) // false | 'save' | 'send'
  const [showPrint, setShowPrint] = useState(false)
  const [refsError, setRefsError] = useState('')
  const [quoteLoadError, setQuoteLoadError] = useState('')

  const [mode, setMode] = useState('auto')
  const [meta, setMeta] = useState({ clientRef: '', quoteDate: new Date().toISOString().slice(0, 10), validUntil: '', site: '', scopeOfWork: '' })

  // auto-mode state
  const [quoteType, setQuoteType] = useState('residential')
  const [selectedPackageId, setSelectedPackageId] = useState('')
  const [items, setItems] = useState([])
  const [travel, setTravel] = useState({ enabled: false, km: '', ratePerKm: '' })
  const [breakdown, setBreakdown] = useState(null)
  const [calculating, setCalculating] = useState(false)
  const [calcError, setCalcError] = useState('')

  // manual-mode state
  const [sections, setSections] = useState([newSection('Capital Equipment')])

  // Clients and packages load independently of the quote itself — if they
  // fail, the builder stays usable and a banner offers a retry (the client
  // dropdown would otherwise just be silently empty).
  function loadRefs() {
    setRefsError('')
    Promise.all([api.get('/clients'), api.get('/packages')])
      .then(([c, p]) => { setClients(c); setPackages(p) })
      .catch(err => setRefsError(err.message))
  }

  useEffect(loadRefs, [])

  function loadQuote() {
    if (!id) return
    setLoading(true)
    setQuoteLoadError('')
    api.get(`/quotes/${id}`).then(q => {
      setQuote(q)
      setMode(q.mode || 'auto')
      setMeta({
        clientRef: q.clientRef?._id || q.clientRef || '',
        quoteDate: q.quoteDate ? q.quoteDate.slice(0, 10) : '',
        validUntil: q.validUntil ? q.validUntil.slice(0, 10) : '',
        site: q.site || '', scopeOfWork: q.scopeOfWork || '',
      })
      if (q.mode === 'manual' && q.sections?.length) {
        setSections(q.sections.map(s => ({
          id: Date.now() + Math.random(), title: s.title,
          items: s.items.map(l => ({ id: Date.now() + Math.random(), description: l.description, detail: l.detail, qty: l.qty, unit: l.unit, unitPrice: l.unitPrice, discountPct: l.discountPct })),
        })))
      } else {
        setQuoteType(q.type === 'corporate' ? 'corporate' : 'residential')
        setSelectedPackageId(q.packageRef?._id || q.packageRef || '')
        setItems((q.items || []).filter(i => i.supplierCost !== undefined).map(i => ({ id: Date.now() + Math.random(), description: i.description, supplierCost: i.supplierCost, qty: i.qty })))
        if (q.travelKm) setTravel({ enabled: true, km: q.travelKm, ratePerKm: q.travelRatePerKm })
      }
    }).catch(err => setQuoteLoadError(err.message)).finally(() => setLoading(false))
  }

  useEffect(loadQuote, [id])

  // Fetches a fresh pricing breakdown from the server for the current auto-mode
  // inputs. Shared by the Calculate button and the save/print flow so the
  // printed PDF always reflects current inputs (never a stale or missing
  // breakdown — see BUGS_AND_FIXES.md).
  function fetchBreakdown() {
    const validItems = items.filter(i => i.description && Number(i.supplierCost) > 0)
    return api.post('/quotes/calculate', {
      type: quoteType,
      packageId: selectedPackageId || undefined,
      items: validItems.map(i => ({ description: i.description, supplierCost: Number(i.supplierCost), qty: Number(i.qty) || 1 })),
      travel: travel.enabled && travel.km && travel.ratePerKm ? { km: Number(travel.km), ratePerKm: Number(travel.ratePerKm) } : undefined,
    })
  }

  async function calculate() {
    setCalcError('')
    const validItems = items.filter(i => i.description && Number(i.supplierCost) > 0)
    if (quoteType === 'residential' && !selectedPackageId && validItems.length === 0) {
      setCalcError('Select a package or add at least one item with a supplier cost.'); return
    }
    if (quoteType === 'corporate' && validItems.length === 0) {
      setCalcError('Add at least one item with a supplier cost.'); return
    }
    setCalculating(true)
    try {
      setBreakdown(await fetchBreakdown())
    } catch (err) {
      setCalcError(err.message)
    } finally {
      setCalculating(false)
    }
  }

  function buildBody(status) {
    const base = {
      mode, clientRef: meta.clientRef || undefined,
      site: meta.site, scopeOfWork: meta.scopeOfWork,
      quoteDate: meta.quoteDate || undefined, validUntil: meta.validUntil || undefined,
      preparedBy: user?.username || '',
      status,
    }
    if (mode === 'manual') {
      return {
        ...base,
        sections: sections.map(s => ({
          title: s.title,
          items: s.items.map(l => ({ description: l.description, detail: l.detail, qty: Number(l.qty) || 1, unit: l.unit, unitPrice: Number(l.unitPrice) || 0, discountPct: Number(l.discountPct) || 0 })),
        })),
      }
    }
    const validItems = items.filter(i => i.description && Number(i.supplierCost) > 0)
    return {
      ...base,
      type: quoteType,
      packageId: selectedPackageId || undefined,
      items: validItems.map(i => ({ description: i.description, supplierCost: Number(i.supplierCost), qty: Number(i.qty) || 1 })),
      travel: travel.enabled && travel.km && travel.ratePerKm ? { km: Number(travel.km), ratePerKm: Number(travel.ratePerKm) } : undefined,
    }
  }

  async function save(sendNow) {
    setError('')
    if (!meta.clientRef) { setError('Select a client before saving.'); return }
    setSaving(sendNow ? 'send' : 'save')
    try {
      let saved
      if (quote?._id) {
        saved = await api.put(`/quotes/admin/${quote._id}`, buildBody())
        if (sendNow) saved = await api.patch(`/quotes/${quote._id}/status`, { status: 'sent' })
      } else {
        saved = await api.post('/quotes/admin', buildBody(sendNow ? 'sent' : 'draft'))
        navigate(`/quotes/${saved._id}/edit`, { replace: true })
      }
      setQuote(saved)
      setNotice(sendNow ? `Quote ${saved.quoteNumber} sent.` : `Quote ${saved.quoteNumber} saved to the client file.`)
      if (sendNow) {
        // The printed PDF renders from the live client-side breakdown, which
        // may be stale (inputs edited since the last Calculate) or missing
        // (sent without calculating, or a reopened quote where loadQuote never
        // sets it). Refresh it so the customer's PDF always matches the saved
        // quote instead of showing blank/"-" totals.
        if (mode === 'auto') {
          try { setBreakdown(await fetchBreakdown()) }
          catch { setError('Quote saved, but its totals could not be prepared for printing — click Calculate, then print again.'); return }
        }
        setShowPrint(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const manualTotals = calcManualQuoteTotals(sections)
  const selectedClient = clients.find(c => c._id === meta.clientRef)
  const selectedPkg = packages.find(p => p._id === selectedPackageId)
  const isLocked = !!quote // mode toggle locks once a quote exists

  if (loading) return <div className="card"><LoadingState /></div>

  if (quoteLoadError) {
    return (
      <div>
        <button className="back-link" onClick={() => navigate('/quotes')}><i className="fas fa-arrow-left" /> Back to quotes</button>
        <div className="card">
          <LoadErrorState onRetry={loadQuote}>
            Couldn't load this quote — {quoteLoadError}.
          </LoadErrorState>
        </div>
      </div>
    )
  }

  return (
    <div>
      <button className="back-link" onClick={() => navigate('/quotes')}><i className="fas fa-arrow-left" /> Back to quotes</button>
      {notice && <div className="qb-notice">{notice}</div>}
      {refsError && (
        <ActionErrorBanner onDismiss={() => setRefsError('')}>
          Couldn't load the client and package lists — {refsError}.{' '}
          <button type="button" className="btn btn-ghost" style={{ padding: '0.1rem 0.5rem' }} onClick={loadRefs}>Retry</button>
        </ActionErrorBanner>
      )}

      <div className="qb-card">
        <div className="qb-card-title-row">
          <div className="qb-card-title">{quote ? `Quote ${quote.quoteNumber}` : 'New Quote'}</div>
          <div className="qb-card-title-note">Prices in ZAR · VAT 15%</div>
        </div>

        <div className="qb-meta-grid">
          <div className="qb-field">
            <label htmlFor="meta-client">Client *</label>
            <select id="meta-client" value={meta.clientRef} onChange={e => setMeta(m => ({ ...m, clientRef: e.target.value }))}>
              <option value="">— Select client —</option>
              {clients.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div className="qb-field">
            <label htmlFor="meta-date">Quote date</label>
            <input id="meta-date" type="date" value={meta.quoteDate} onChange={e => setMeta(m => ({ ...m, quoteDate: e.target.value }))} />
          </div>
          <div className="qb-field">
            <label htmlFor="meta-valid">Valid until</label>
            <input id="meta-valid" type="date" value={meta.validUntil} onChange={e => setMeta(m => ({ ...m, validUntil: e.target.value }))} />
          </div>
          <div className="qb-field">
            <label htmlFor="meta-prepared">Prepared by</label>
            <input id="meta-prepared" value={user?.username || ''} readOnly />
          </div>
        </div>
        <div className="qb-meta-grid2">
          <div className="qb-field">
            <label htmlFor="meta-site">Site</label>
            <input id="meta-site" value={meta.site} onChange={e => setMeta(m => ({ ...m, site: e.target.value }))} placeholder="e.g. Head office" />
          </div>
          <div className="qb-field">
            <label htmlFor="meta-scope">Scope of work</label>
            <input id="meta-scope" value={meta.scopeOfWork} onChange={e => setMeta(m => ({ ...m, scopeOfWork: e.target.value }))} placeholder="e.g. CCTV supply and installation" />
          </div>
        </div>

        <div className="qb-type-toggle" style={{ marginBottom: '1.25rem' }}>
          <button type="button" className={mode === 'auto' ? 'active' : ''} disabled={isLocked} onClick={() => setMode('auto')}>
            <i className="fas fa-calculator" /> Auto-priced
          </button>
          <button type="button" className={mode === 'manual' ? 'active' : ''} disabled={isLocked} onClick={() => setMode('manual')}>
            <i className="fas fa-table-list" /> Manual / Sectioned
          </button>
        </div>

        {mode === 'auto' ? (
          <AutoModeEditor
            packages={packages} quoteType={quoteType} setQuoteType={setQuoteType}
            selectedPackageId={selectedPackageId} setSelectedPackageId={setSelectedPackageId}
            items={items} setItems={setItems} travel={travel} setTravel={setTravel}
            breakdown={breakdown} calculating={calculating} calcError={calcError} onCalculate={calculate}
          />
        ) : (
          <SectionedEditor sections={sections} setSections={setSections} />
        )}

        <div className="qb-totals-wrap">
          <div className="qb-totals-box">
            {mode === 'manual' ? (
              <>
                <div className="qb-totals-row"><span>Subtotal</span><span>{ZAR(manualTotals.subtotal)}</span></div>
                <div className="qb-totals-row"><span>VAT (15%)</span><span>{ZAR(manualTotals.vatAmount)}</span></div>
                <div className="qb-totals-grand"><span>Grand Total</span><span>{ZAR(manualTotals.total)}</span></div>
              </>
            ) : breakdown ? (
              <>
                <div className="qb-totals-row"><span>Subtotal</span><span>{ZAR(breakdown.grand.subtotal)}</span></div>
                <div className="qb-totals-row"><span>VAT (15%)</span><span>{ZAR(breakdown.grand.vatAmount)}</span></div>
                <div className="qb-totals-grand"><span>Grand Total</span><span>{ZAR(breakdown.grand.total)}</span></div>
              </>
            ) : (
              <div className="qb-totals-row"><span>Click Calculate to see totals</span></div>
            )}
          </div>
        </div>

        <div className="qb-bank-grid">
          <div>
            <div className="qb-bank-label">Banking Details</div>
            <div className="qb-bank-text">
              Mashtronics Business Enterprise (Pty) Ltd<br />
              First National Bank · Branch Code 254005<br />
              Account Number 62684779063
            </div>
          </div>
          <div>
            <div className="qb-bank-label">Acceptance of Quotation</div>
            <div className="qb-sign-line" />
            <div className="qb-sign-caption">Full name &amp; signature</div>
          </div>
        </div>

        {error && <div className="error-banner"><i className="fas fa-exclamation-circle" />{error}</div>}

        <div className="qb-actions">
          <button className="btn btn-ghost" disabled={!!saving} onClick={() => save(false)}>
            {saving === 'save'
              ? <><i className="fas fa-spinner fa-spin" /> Saving…</>
              : <><i className="fas fa-save" /> Save to Client File</>}
          </button>
          <button className="btn btn-primary" disabled={!!saving} onClick={() => save(true)}>
            {saving === 'send'
              ? <><i className="fas fa-spinner fa-spin" /> Sending…</>
              : <><i className="fas fa-paper-plane" /> Send Quote</>}
          </button>
        </div>
      </div>

      {showPrint && (
        <QuotePrint
          customer={{ name: selectedClient?.name || '', phone: selectedClient?.contactPhone || '', email: selectedClient?.contactEmail || '', address: selectedClient?.billingAddress || '' }}
          scopeOfWork={meta.scopeOfWork}
          breakdown={mode === 'auto' ? breakdown : undefined}
          sections={mode === 'manual' ? sections : undefined}
          totals={mode === 'manual' ? manualTotals : undefined}
          savedQuote={quote}
          selectedPkg={selectedPkg}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}
