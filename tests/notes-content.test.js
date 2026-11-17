import { describe, expect, it } from 'vitest';
import { isPresenterSnapshot } from '../src/notes-content.js';

describe('presenter snapshot validation', () => {
  const valid = { version: 1, slideId: 'welcome', title: 'Welcome', notesHtml: '<p>Show terminal</p>', position: 1, total: 28 };
  it('accepts a complete presenter snapshot', () => {
    expect(isPresenterSnapshot(valid)).toBe(true);
  });
  it('rejects malformed or oversized presenter snapshots', () => {
    expect(isPresenterSnapshot(null)).toBe(false);
    expect(isPresenterSnapshot({ ...valid, position: 29 })).toBe(false);
    expect(isPresenterSnapshot({ ...valid, notesHtml: 'x'.repeat(100001) })).toBe(false);
    expect(isPresenterSnapshot({ ...valid, title: 'x'.repeat(1001) })).toBe(false);
    expect(isPresenterSnapshot({ ...valid, total: 1001 })).toBe(false);
  });
});
