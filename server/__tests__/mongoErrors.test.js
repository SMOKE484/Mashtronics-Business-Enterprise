'use strict';
const { friendlySaveError } = require('../utils/mongoErrors');

describe('friendlySaveError', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('translates a duplicate-key error using the offending field', () => {
    const err = { code: 11000, keyPattern: { supabaseUserId: 1 } };
    expect(friendlySaveError(err, 'technician')).toBe('A technician with that supabaseUserId already exists.');
  });

  test('falls back to a generic duplicate message when keyPattern is missing', () => {
    const err = { code: 11000 };
    expect(friendlySaveError(err, 'client')).toBe('That client already exists.');
  });

  test('surfaces the first Mongoose validation message', () => {
    const err = { name: 'ValidationError', errors: { name: { message: 'Path `name` is required.' } } };
    expect(friendlySaveError(err, 'client')).toBe('Path `name` is required.');
  });

  test('never leaks a raw error message for an unrecognized error shape', () => {
    const err = new Error('MongoServerError: connection to 10.0.0.5:27017 refused');
    expect(friendlySaveError(err, 'client')).toBe("Couldn't save that client. Please try again.");
  });

  test('logs the original error server-side regardless of type', () => {
    const err = new Error('boom');
    friendlySaveError(err, 'client');
    expect(consoleErrorSpy).toHaveBeenCalledWith(err);
  });
});
