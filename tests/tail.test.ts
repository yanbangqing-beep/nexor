import { describe, expect, it } from 'vitest';
import { tailFit } from '../src/ui/tail.js';

describe('tailFit', () => {
  it('returns text unchanged when within budget', () => {
    const r = tailFit('one\ntwo\nthree', 5);
    expect(r).toEqual({ visible: 'one\ntwo\nthree', truncatedAbove: false });
  });

  it('returns text unchanged at the exact-fit boundary', () => {
    const r = tailFit('one\ntwo\nthree', 3);
    expect(r.truncatedAbove).toBe(false);
    expect(r.visible).toBe('one\ntwo\nthree');
  });

  it('keeps only the trailing N lines when over budget', () => {
    const r = tailFit('a\nb\nc\nd\ne', 3);
    expect(r).toEqual({ visible: 'c\nd\ne', truncatedAbove: true });
  });

  it('handles single-line input', () => {
    const r = tailFit('only line', 5);
    expect(r).toEqual({ visible: 'only line', truncatedAbove: false });
  });

  it('handles empty input', () => {
    const r = tailFit('', 5);
    expect(r).toEqual({ visible: '', truncatedAbove: false });
  });

  it('returns empty visible when budget is zero and text exists', () => {
    const r = tailFit('something', 0);
    expect(r).toEqual({ visible: '', truncatedAbove: true });
  });

  it('returns empty visible when budget is zero and text is empty', () => {
    const r = tailFit('', 0);
    expect(r).toEqual({ visible: '', truncatedAbove: false });
  });

  it('preserves the most recent line when budget is 1', () => {
    const r = tailFit('a\nb\nlatest', 1);
    expect(r).toEqual({ visible: 'latest', truncatedAbove: true });
  });

  it('preserves a trailing newline as an empty final line', () => {
    const r = tailFit('a\nb\n', 5);
    // 'a\nb\n'.split('\n') === ['a','b',''] — three logical lines, fits in 5.
    expect(r.truncatedAbove).toBe(false);
    expect(r.visible).toBe('a\nb\n');
  });
});
