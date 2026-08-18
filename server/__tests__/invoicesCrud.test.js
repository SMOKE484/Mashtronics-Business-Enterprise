'use strict';
jest.mock('../models/Invoice', () => ({ create: jest.fn(), findByIdAndUpdate: jest.fn(), findByIdAndDelete: jest.fn() }));
jest.mock('../models/Counter', () => ({ findOneAndUpdate: jest.fn() }));
const Invoice = require('../models/Invoice');
const Counter = require('../models/Counter');
const { createHandler, updateHandler, deleteHandler } = require('../routes/invoices');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

describe('POST /api/invoices', () => {
  test('creates an invoice with a generated invoice number and server-computed amount', async () => {
    Counter.findOneAndUpdate.mockResolvedValue({ seq: 7 });
    const invoice = { _id: 'i1', invoiceNumber: 'INV-2026-007' };
    Invoice.create.mockResolvedValue(invoice);
    const req = { body: { clientRef: 'c1', subtotal: 100, vatAmount: 15, issuedDate: '2026-07-01', dueDate: '2026-07-31' } };
    const res = mockRes();

    await createHandler(req, res);

    expect(Invoice.create).toHaveBeenCalledWith(expect.objectContaining({ subtotal: 100, vatAmount: 15, amount: 115 }));
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(invoice);
  });

  test('translates a save failure into a friendly message, never the raw Mongo string', async () => {
    Counter.findOneAndUpdate.mockResolvedValue({ seq: 1 });
    Invoice.create.mockRejectedValue({
      code: 11000,
      keyPattern: { invoiceNumber: 1 },
      message: 'E11000 duplicate key error collection: mashtronics.invoices',
    });
    const req = { body: { subtotal: 100, vatAmount: 15 } };
    const res = mockRes();

    await createHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const [{ error }] = res.json.mock.calls[0];
    expect(error).not.toMatch(/E11000|collection:/);
  });
});

describe('PUT /api/invoices/:id', () => {
  test('recomputes amount when subtotal/vatAmount are both provided', async () => {
    const invoice = { _id: 'i1', amount: 230 };
    Invoice.findByIdAndUpdate.mockResolvedValue(invoice);
    const req = { params: { id: 'i1' }, body: { subtotal: 200, vatAmount: 30 } };
    const res = mockRes();

    await updateHandler(req, res);

    expect(Invoice.findByIdAndUpdate).toHaveBeenCalledWith(
      'i1',
      { subtotal: 200, vatAmount: 30, amount: 230 },
      { new: true, runValidators: true }
    );
    expect(res.json).toHaveBeenCalledWith(invoice);
  });

  test('strips invoiceNumber/amount from the body so they cannot be spoofed', async () => {
    Invoice.findByIdAndUpdate.mockResolvedValue({ _id: 'i1' });
    const req = { params: { id: 'i1' }, body: { invoiceNumber: 'HACKED', amount: 999999, dueDate: '2026-08-01' } };
    const res = mockRes();

    await updateHandler(req, res);

    expect(Invoice.findByIdAndUpdate).toHaveBeenCalledWith('i1', { dueDate: '2026-08-01' }, { new: true, runValidators: true });
  });

  test('404s when the invoice does not exist', async () => {
    Invoice.findByIdAndUpdate.mockResolvedValue(null);
    const req = { params: { id: 'missing' }, body: {} };
    const res = mockRes();

    await updateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });
});

describe('DELETE /api/invoices/:id', () => {
  test('deletes an existing invoice', async () => {
    Invoice.findByIdAndDelete.mockResolvedValue({ _id: 'i1' });
    const req = { params: { id: 'i1' } };
    const res = mockRes();

    await deleteHandler(req, res);

    expect(Invoice.findByIdAndDelete).toHaveBeenCalledWith('i1');
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  test('404s when the invoice does not exist', async () => {
    Invoice.findByIdAndDelete.mockResolvedValue(null);
    const req = { params: { id: 'missing' } };
    const res = mockRes();

    await deleteHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });

  test('returns 500 when the delete throws', async () => {
    Invoice.findByIdAndDelete.mockRejectedValue(new Error('db down'));
    const req = { params: { id: 'i1' } };
    const res = mockRes();

    await deleteHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
  });
});
