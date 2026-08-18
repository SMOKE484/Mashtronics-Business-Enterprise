import { checklistProgress, canContinueChecklist, hasProofPhoto, canComplete } from './jobGating';

const job = (overrides = {}) => ({
  status: 'in-progress',
  checklist: [{ label: 'a', done: true }, { label: 'b', done: true }],
  photos: [{ path: 'p', url: null }],
  ...overrides,
});

describe('checklistProgress', () => {
  test('counts done vs total', () => {
    expect(checklistProgress(job({ checklist: [{ done: true }, { done: false }] }))).toEqual({ done: 1, total: 2 });
  });
  test('handles a missing job or checklist', () => {
    expect(checklistProgress(null)).toEqual({ done: 0, total: 0 });
    expect(checklistProgress({})).toEqual({ done: 0, total: 0 });
  });
});

describe('canContinueChecklist', () => {
  test('true only when every item is done', () => {
    expect(canContinueChecklist(job())).toBe(true);
    expect(canContinueChecklist(job({ checklist: [{ done: true }, { done: false }] }))).toBe(false);
  });
  test('an empty checklist is trivially complete (matches the server)', () => {
    expect(canContinueChecklist(job({ checklist: [] }))).toBe(true);
  });
});

describe('hasProofPhoto', () => {
  test('requires at least one photo', () => {
    expect(hasProofPhoto(job())).toBe(true);
    expect(hasProofPhoto(job({ photos: [] }))).toBe(false);
    expect(hasProofPhoto(null)).toBe(false);
  });
});

describe('canComplete', () => {
  const strokes = ['M0 0L5 5'];

  test('true when every gate passes', () => {
    expect(canComplete(job(), strokes)).toBe(true);
  });
  test('false without a signature', () => {
    expect(canComplete(job(), [])).toBe(false);
    expect(canComplete(job(), null)).toBe(false);
  });
  test('false with an unfinished checklist', () => {
    expect(canComplete(job({ checklist: [{ done: false }] }), strokes)).toBe(false);
  });
  test('false with no photos', () => {
    expect(canComplete(job({ photos: [] }), strokes)).toBe(false);
  });
  test('false unless the job is in progress', () => {
    expect(canComplete(job({ status: 'upcoming' }), strokes)).toBe(false);
    expect(canComplete(job({ status: 'done' }), strokes)).toBe(false);
  });
});
