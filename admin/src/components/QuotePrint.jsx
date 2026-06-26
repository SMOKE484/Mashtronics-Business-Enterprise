import logo from '../assets/logo.png'
import './QuotePrint.css'

const fmt = n =>
  n == null ? '-' : Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const today = () => {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export default function QuotePrint({ customer, scopeOfWork, breakdown, savedQuote, selectedPkg, onClose }) {
  const quoteNumber = savedQuote?.quoteNumber || 'DRAFT'

  const lineItems = []
  if (breakdown?.packageBreakdown && selectedPkg) {
    lineItems.push({
      description: `${selectedPkg.name}\n${selectedPkg.description || ''}`.trim(),
      qty: 1,
      unit: 'each',
      unitPrice: breakdown.packageBreakdown.exclVAT,
      total: breakdown.packageBreakdown.exclVAT,
    })
  }
  if (breakdown?.itemsBreakdown) {
    lineItems.push({
      description: 'Custom equipment – supply and installation',
      qty: 1,
      unit: 'set',
      unitPrice: breakdown.itemsBreakdown.subtotal,
      total: breakdown.itemsBreakdown.subtotal,
    })
  }
  if (breakdown?.travelBreakdown) {
    lineItems.push({
      description: `Travel (${breakdown.travelBreakdown.km} km @ R${breakdown.travelBreakdown.ratePerKm}/km)`,
      qty: 1,
      unit: 'trip',
      unitPrice: breakdown.travelBreakdown.travelExcl,
      total: breakdown.travelBreakdown.travelExcl,
    })
  }

  const MIN_ROWS = 9
  const rows = [...lineItems]
  while (rows.length < MIN_ROWS) rows.push(null)

  return (
    <div className="qp-overlay">
      <div className="qp-toolbar no-print">
        <button className="qp-btn-close" onClick={onClose}>
          <i className="fas fa-times" /> Close
        </button>
        <button className="qp-btn-print" onClick={() => window.print()}>
          <i className="fas fa-print" /> Print / Save PDF
        </button>
      </div>

      <div className="qp-page">
        {/* ── Company header ── */}
        <div className="qp-header">
          <div className="qp-header__logo">
            <img src={logo} alt="Mashtronics" />
          </div>
          <div className="qp-header__details">
            <strong>Mashtronics Business Enterprise</strong>
            <span>Unit 16A, Medgate Centre</span>
            <span>Kingfisher Street, Helderkruin</span>
            <span>Roodepoort</span>
            <span>&nbsp;</span>
            <span>Tel: 011 765 4148</span>
            <span>www.mashtronicsbe.co.za</span>
            <span>PSIRA No: 2957012</span>
            <span>Vat no.: 4320284435</span>
          </div>
        </div>

        {/* ── Title ── */}
        <div className="qp-title">QUOTATION</div>
        {scopeOfWork && (
          <div className="qp-scope">
            <strong>SCOPE OF WORK:</strong> {scopeOfWork}
          </div>
        )}

        {/* ── Client info ── */}
        <table className="qp-client-table">
          <tbody>
            <tr>
              <td className="qp-client-label" style={{ verticalAlign: 'top', width: '40px' }}>TO:</td>
              <td style={{ verticalAlign: 'top' }}>
                <strong>{customer.name || '—'}</strong>
                {customer.address && (
                  <div style={{ whiteSpace: 'pre-line', marginTop: '2px' }}>{customer.address}</div>
                )}
              </td>
              <td style={{ width: '70px', verticalAlign: 'top' }}>
                {customer.emis && <div className="qp-client-label">Emis No:</div>}
                <div className="qp-client-label">Tel:</div>
              </td>
              <td style={{ verticalAlign: 'top' }}>
                {customer.emis && <div>{customer.emis}</div>}
                <div>{customer.phone || '—'}</div>
              </td>
              <td style={{ width: '60px', verticalAlign: 'top', textAlign: 'right' }}>
                <div className="qp-client-label">Quote:</div>
                <div className="qp-client-label">Date:</div>
              </td>
              <td style={{ verticalAlign: 'top', textAlign: 'right', minWidth: '100px' }}>
                <div>{quoteNumber}</div>
                <div>{today()}</div>
              </td>
            </tr>
            {customer.attention && (
              <tr>
                <td className="qp-client-label">Attention:</td>
                <td colSpan={3}>{customer.attention}</td>
                <td />
                <td />
              </tr>
            )}
            {customer.email && (
              <tr>
                <td />
                <td />
                <td className="qp-client-label">Email:</td>
                <td colSpan={3}>{customer.email}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* ── Line items ── */}
        <table className="qp-items-table">
          <thead>
            <tr className="qp-items-head">
              <th className="qp-th qp-col-no">Item no.</th>
              <th className="qp-th qp-col-desc">Description</th>
              <th className="qp-th qp-col-qty">Qty</th>
              <th className="qp-th qp-col-unit">Unit</th>
              <th className="qp-th qp-col-price">Unit Price</th>
              <th className="qp-th qp-col-disc">Disc%</th>
              <th className="qp-th qp-col-total">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="qp-items-row">
                <td className="qp-td qp-col-no">{i + 1}</td>
                <td className="qp-td qp-col-desc" style={{ whiteSpace: 'pre-line' }}>{row?.description || ''}</td>
                <td className="qp-td qp-col-qty">{row ? row.qty : ''}</td>
                <td className="qp-td qp-col-unit">{row?.unit || ''}</td>
                <td className="qp-td qp-col-price">{row ? `R  ${fmt(row.unitPrice)}` : ''}</td>
                <td className="qp-td qp-col-disc">{row ? '0.00%' : ''}</td>
                <td className="qp-td qp-col-total">{row ? `R  ${fmt(row.total)}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Footer ── */}
        <div className="qp-footer">
          <div className="qp-footer__bank">
            <div className="qp-footer__label">Bank details:</div>
            <div>Mashtronics Business Enterprise (Pty) Ltd</div>
            <div>First National Bank</div>
            <div>Branch Code: 254005</div>
            <div>Account Number: 62684779063</div>
          </div>

          <div className="qp-footer__notes">
            <div className="qp-footer__label">Notes:</div>
            <div>Thank you for giving us the opportunity</div>
            <div>to quote you</div>
          </div>

          <div className="qp-footer__totals">
            <div className="qp-totals-row">
              <span>Total</span>
              <span>R</span>
              <span>{fmt(breakdown?.grand?.subtotal)}</span>
            </div>
            <div className="qp-totals-row">
              <span>V.A.T.</span>
              <span>R</span>
              <span>{fmt(breakdown?.grand?.vatAmount)}</span>
            </div>
            <div className="qp-totals-row qp-totals-grand">
              <span>Grand Total</span>
              <span>R</span>
              <span>{fmt(breakdown?.grand?.total)}</span>
            </div>
          </div>
        </div>

        {/* ── Acceptance ── */}
        <div className="qp-acceptance">
          <div className="qp-acceptance__title">Acceptance of quotation:</div>
          <div className="qp-acceptance__row">
            <div className="qp-acceptance__field">
              <div className="qp-acceptance__line" />
              <div className="qp-acceptance__label">Full Name</div>
            </div>
            <div className="qp-acceptance__field">
              <div className="qp-acceptance__line" />
              <div className="qp-acceptance__label">Signature</div>
            </div>
          </div>
          <div className="qp-acceptance__row" style={{ marginTop: '2rem' }}>
            <div className="qp-acceptance__field" style={{ maxWidth: '220px' }}>
              <div className="qp-acceptance__line" />
              <div className="qp-acceptance__label">Date</div>
            </div>
          </div>
        </div>

        <div className="qp-pagenum">1 of 1</div>
      </div>
    </div>
  )
}
