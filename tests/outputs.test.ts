import { describe, expect, it } from 'vitest';
import { createOutputStore } from '../src/state/outputs.js';

describe('OutputStore', () => {
  it('returns empty string for unknown session', () => {
    const store = createOutputStore();
    expect(store.get('nope')).toBe('');
  });

  it('appends text and concatenates by session', () => {
    const store = createOutputStore();
    store.append('a', 'hello ');
    store.append('a', 'world');
    expect(store.get('a')).toBe('hello world');
  });

  it('keeps separate buffers per session', () => {
    const store = createOutputStore();
    store.append('a', 'A');
    store.append('b', 'B');
    expect(store.get('a')).toBe('A');
    expect(store.get('b')).toBe('B');
  });

  it('clear empties one session without affecting others', () => {
    const store = createOutputStore();
    store.append('a', 'A');
    store.append('b', 'B');
    store.clear('a');
    expect(store.get('a')).toBe('');
    expect(store.get('b')).toBe('B');
  });

  it('delete drops the buffer entirely', () => {
    const store = createOutputStore();
    store.append('a', 'A');
    store.delete('a');
    expect(store.get('a')).toBe('');
  });

  it('subscribers are called on every mutation', () => {
    const store = createOutputStore();
    let count = 0;
    store.subscribe(() => count++);
    store.append('a', 'x');
    store.append('a', 'y');
    store.clear('a');
    store.delete('a');
    expect(count).toBe(4);
  });
});
