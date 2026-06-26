'use strict';

const VAT_RATE = 0.15;

function r2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Package pricing — priceInclVAT is the final installed price including VAT.
 * Decomposes into excl/VAT split for display on quotes.
 */
function calcPackage(priceInclVAT) {
  const exclVAT   = r2(priceInclVAT / (1 + VAT_RATE));
  const vatAmount = r2(exclVAT * VAT_RATE);
  return { exclVAT, vatAmount, total: r2(priceInclVAT) };
}

/**
 * Custom residential quote.
 * Markup: 20% on supplier cost. Installation: 30% of marked-up cost, min R3,000.
 * VAT: 15% on (markedUp + installation).
 */
function calcCustomResidential({ supplierCost, qty = 1 }) {
  const baseCost    = r2(supplierCost * qty);
  const markedUp    = r2(baseCost * 1.20);
  const installation = r2(Math.max(markedUp * 0.30, 3000));
  const subtotal    = r2(markedUp + installation);
  const vatAmount   = r2(subtotal * VAT_RATE);
  const total       = r2(subtotal + vatAmount);
  return { markedUp, installation, subtotal, vatAmount, total };
}

/**
 * Corporate quote.
 * Markup: 35% on supplier cost. Installation: 30% of marked-up cost, min R5,000.
 * VAT: 15% on (markedUp + installation).
 */
function calcCorporate({ supplierCost, qty = 1 }) {
  const baseCost    = r2(supplierCost * qty);
  const markedUp    = r2(baseCost * 1.35);
  const installation = r2(Math.max(markedUp * 0.30, 5000));
  const subtotal    = r2(markedUp + installation);
  const vatAmount   = r2(subtotal * VAT_RATE);
  const total       = r2(subtotal + vatAmount);
  return { markedUp, installation, subtotal, vatAmount, total };
}

/**
 * Travel charge. km and ratePerKm entered by admin per quote.
 * VAT (15%) applies to travel.
 */
function calcTravel(km, ratePerKm) {
  const travelExcl  = r2(km * ratePerKm);
  const travelVAT   = r2(travelExcl * VAT_RATE);
  const travelTotal = r2(travelExcl + travelVAT);
  return { km, ratePerKm, travelExcl, travelVAT, travelTotal };
}

module.exports = { calcPackage, calcCustomResidential, calcCorporate, calcTravel };
