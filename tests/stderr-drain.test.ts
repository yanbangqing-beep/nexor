import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { drainStderr } from '../src/adapters/base.js';

describe('drainStderr', () => {
  it('returns empty string when stream is null', async () => {
    expect(await drainStderr(null)).toBe('');
  });

  it('returns empty string when stream emits nothing', async () => {
    const s = Readable.from([] as string[]);
    expect(await drainStderr(s)).toBe('');
  });

  it('concatenates and trims chunks', async () => {
    const s = Readable.from(['line one\n', 'line two\n']);
    expect(await drainStderr(s)).toBe('line one\nline two');
  });

  it('caps at maxBytes and appends truncation marker', async () => {
    const big = 'x'.repeat(20);
    const s = Readable.from([big]);
    const out = await drainStderr(s, 8);
    expect(out.startsWith('xxxxxxxx')).toBe(true);
    expect(out).toContain('[stderr truncated]');
  });

  it('handles Buffer chunks', async () => {
    const s = Readable.from([Buffer.from('boom\n'), Buffer.from('bang')]);
    expect(await drainStderr(s)).toBe('boom\nbang');
  });
});
