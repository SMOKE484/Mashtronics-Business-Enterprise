// Client-side mirror of server/services/quoteCalc.js — for live preview only.
// The server always recomputes and stores the authoritative totals on save.

function r2(n) {
  return Math.round(n * 100) / 100
}

export function calcLineTotal({ qty = 1, unitPrice = 0, discountPct = 0 }) {
  return r2((Number(qty) || 0) * (Number(unitPrice) || 0) * (1 - (Number(discountPct) || 0) / 100))
}

export function calcSectionSubtotal(items = []) {
  return r2(items.reduce((sum, item) => sum + calcLineTotal(item), 0))
}

export function calcManualQuoteTotals(sections = []) {
  const subtotal = r2(sections.reduce((sum, sec) => sum + calcSectionSubtotal(sec.items), 0))
  const vatAmount = r2(subtotal * 0.15)
  const total = r2(subtotal + vatAmount)
  return { subtotal, vatAmount, total }
}
