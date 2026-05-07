import { describe, expect, it } from 'vitest';
import { createOutputStore } from '../src/state/outputs.js';

describe('OutputStore with 5MB cap', () => {
  it('retains all text below cap', () => {
    const store = createOutputStore();
    store.append('a', 'hello world\n');
    expect(store.get('a')).toBe('hello world\n');
    expect(store.isTruncated('a')).toBe(false);
  });

  it('truncates from the front when exceeding 5MB', () => {
    const store = createOutputStore();
    const big = 'x'.repeat(2 * 1024 * 1024); // 2 MB
    store.append('a', big);
    store.append('a', big);
    store.append('a', big); // 6 MB total
    expect(store.isTruncated('a')).toBe(true);
    const text = store.get('a');
    expect(text).toContain('[earlier output truncated]');
    // Should be under 5MB
    expect(Buffer.byteLength(text, 'utf8')).toBeLessThanOrEqual(5 * 1024 * 1024 + 50); // +50 for truncation marker
  });

  it('preserves truncation marker across further appends', () => {
    const store = createOutputStore();
    const big = 'x'.repeat(6 * 1024 * 1024);
    store.append('a', big);
    expect(store.isTruncated('a')).toBe(true);
    store.append('a', 'tail');
    expect(store.get('a')).toContain('[earlier output truncated]');
  });

  it('clear resets truncation flag', () => {
    const store = createOutputStore();
    store.append('a', 'x'.repeat(6 * 1024 * 1024));
    expect(store.isTruncated('a')).toBe(true);
    store.clear('a');
    expect(store.isTruncated('a')).toBe(false);
    expect(store.get('a')).toBe('');
  });
});
