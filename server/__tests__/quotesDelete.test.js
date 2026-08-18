'use strict';
jest.mock('../models/Quote', () => ({ findByIdAndDelete: jest.fn() }));
const Quote = require('../models/Quote');
const { deleteHandler } = require('../routes/quotes');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

describe('DELETE /api/quotes/:id', () => {
  test('deletes an existing quote', async () => {
    Quote.findByIdAndDelete.mockResolvedValue({ _id: 'q1' });
    const req = { params: { id: 'q1' } };
    const res = mockRes();

    await deleteHandler(req, res);

    expect(Quote.findByIdAndDelete).toHaveBeenCalledWith('q1');
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  test('404s when the quote does not exist', async () => {
    Quote.findByIdAndDelete.mockResolvedValue(null);
    const req = { params: { id: 'missing' } };
    const res = mockRes();

    await deleteHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });

  test('returns 500 when the delete throws', async () => {
    Quote.findByIdAndDelete.mockRejectedValue(new Error('db down'));
    const req = { params: { id: 'q1' } };
    const res = mockRes();

    await deleteHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
  });
});
