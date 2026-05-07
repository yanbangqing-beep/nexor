import { describe, expect, it } from 'vitest';
import { createPromptHistoryStore } from '../src/state/prompt-history.js';

describe('PromptHistoryStore', () => {
  it('up returns null when empty', () => {
    const h = createPromptHistoryStore();
    expect(h.up('s1')).toBeNull();
  });

  it('pushes and navigates up/down', () => {
    const h = createPromptHistoryStore();
    h.push('s1', 'first');
    h.push('s1', 'second');
    h.push('s1', 'third');
    expect(h.up('s1')).toBe('third');
    expect(h.up('s1')).toBe('second');
    expect(h.up('s1')).toBe('first');
    expect(h.up('s1')).toBe('first'); // clamped at top
  });

  it('navigates down back to newer entries', () => {
    const h = createPromptHistoryStore();
    h.push('s1', 'a');
    h.push('s1', 'b');
    h.push('s1', 'c');
    h.up('s1'); // c
    h.up('s1'); // b
    expect(h.down('s1')).toBe('c');
    expect(h.down('s1')).toBeNull(); // beyond tip
  });

  it('does not push duplicate at tip', () => {
    const h = createPromptHistoryStore();
    h.push('s1', 'same');
    h.push('s1', 'same');
    expect(h.up('s1')).toBe('same');
    expect(h.down('s1')).toBeNull();
  });

  it('caps at 50 entries per session', () => {
    const h = createPromptHistoryStore();
    for (let i = 0; i < 60; i++) {
      h.push('s1', `prompt-${i}`);
    }
    // Navigate to the oldest (should be prompt-10 after 50 items)
    let result: string | null = null;
    for (let i = 0; i < 60; i++) {
      result = h.up('s1');
    }
    expect(result).toBe('prompt-10');
  });

  it('resetCursor puts cursor beyond tip', () => {
    const h = createPromptHistoryStore();
    h.push('s1', 'a');
    h.up('s1');
    h.resetCursor('s1');
    expect(h.down('s1')).toBeNull();
  });

  it('keeps separate histories per session', () => {
    const h = createPromptHistoryStore();
    h.push('s1', 'session-one');
    h.push('s2', 'session-two');
    expect(h.up('s1')).toBe('session-one');
    expect(h.up('s2')).toBe('session-two');
  });
});
