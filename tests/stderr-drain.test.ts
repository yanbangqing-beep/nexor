import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { streamStderrLines } from '../src/adapters/base.js';

async function collect(iter: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const line of iter) out.push(line);
  return out;
}

describe('streamStderrLines', () => {
  it('yields nothing when stream is null', async () => {
    expect(await collect(streamStderrLines(null))).toEqual([]);
  });

  it('yields nothing when stream emits nothing', async () => {
    expect(await collect(streamStderrLines(Readable.from([] as string[])))).toEqual([]);
  });

  it('yields one trimmed line per newline-delimited chunk', async () => {
    const s = Readable.from(['line one\n', 'line two\n']);
    expect(await collect(streamStderrLines(s))).toEqual(['line one', 'line two']);
  });

  it('skips blank lines', async () => {
    const s = Readable.from(['a\n\n\nb\n']);
    expect(await collect(streamStderrLines(s))).toEqual(['a', 'b']);
  });

  it('yields a final tail without trailing newline', async () => {
    const s = Readable.from(['ends-without-newline']);
    expect(await collect(streamStderrLines(s))).toEqual(['ends-without-newline']);
  });

  it('handles Buffer chunks', async () => {
    const s = Readable.from([Buffer.from('boom\n'), Buffer.from('bang')]);
    expect(await collect(streamStderrLines(s))).toEqual(['boom', 'bang']);
  });

  it('stops yielding once the cumulative cap is exceeded', async () => {
    // Cap = 8 bytes total. First two lines (4+4=8) fit, third does not.
    const s = Readable.from(['aaaa\nbbbb\ncccc\n']);
    expect(await collect(streamStderrLines(s, 8))).toEqual(['aaaa', 'bbbb']);
  });
});
