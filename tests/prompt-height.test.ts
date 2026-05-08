import { describe, expect, it } from 'vitest';
import { computePromptInputRows } from '../src/ui/prompt-height.js';

describe('computePromptInputRows', () => {
  it('returns 1 for empty input', () => {
    expect(computePromptInputRows('', 80, 8)).toBe(1);
  });

  it('returns 1 for short single-line input', () => {
    expect(computePromptInputRows('hello', 80, 8)).toBe(1);
  });

  it('counts explicit newlines (Shift+Enter / pasted multi-line)', () => {
    expect(computePromptInputRows('a\nb\nc', 80, 8)).toBe(3);
  });

  it('soft-wraps a long single line based on inner width', () => {
    // columns=20 → innerWidth=16, first-line width=14 (after "> " prefix).
    // 30-char string wraps to ceil(30/14) = 3 rows.
    const longLine = 'x'.repeat(30);
    expect(computePromptInputRows(longLine, 20, 8)).toBe(3);
  });

  it('caps at maxRows so a giant paste cannot exceed the budget', () => {
    const huge = Array(100).fill('line').join('\n');
    expect(computePromptInputRows(huge, 80, 8)).toBe(8);
  });

  it('combines wrap and newlines correctly', () => {
    // line 1: 30 chars, col=20, first-line width=14 → ceil(30/14)=3 rows.
    // line 2: 5 chars → 1 row. Total 4.
    const value = `${'x'.repeat(30)}\nhello`;
    expect(computePromptInputRows(value, 20, 8)).toBe(4);
  });
});
