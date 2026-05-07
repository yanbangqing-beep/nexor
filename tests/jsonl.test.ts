import { describe, expect, it } from 'vitest';
import { parseJsonl } from '../src/adapters/base.js';

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iter) out.push(item);
  return out;
}

async function* fromString(s: string): AsyncIterable<string> {
  yield s;
}

async function* fromChunks(chunks: string[]): AsyncIterable<string> {
  for (const c of chunks) yield c;
}

describe('parseJsonl', () => {
  it('parses well-formed multi-line JSONL', async () => {
    const input = `${JSON.stringify({ a: 1 })}\n${JSON.stringify({ b: 2 })}\n`;
    const result = await collect(parseJsonl(fromString(input)));
    expect(result).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('handles a partial line at end of stream by flushing tail', async () => {
    const input = `${JSON.stringify({ a: 1 })}\n${JSON.stringify({ b: 2 })}`;
    const result = await collect(parseJsonl(fromString(input)));
    expect(result).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('skips empty lines', async () => {
    const input = `${JSON.stringify({ a: 1 })}\n\n\n${JSON.stringify({ b: 2 })}\n`;
    const result = await collect(parseJsonl(fromString(input)));
    expect(result).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('surfaces non-JSON lines as { __raw }', async () => {
    const input = `not json\n${JSON.stringify({ a: 1 })}\n`;
    const result = await collect(parseJsonl(fromString(input)));
    expect(result).toEqual([{ __raw: 'not json' }, { a: 1 }]);
  });

  it('reassembles JSON split across multiple chunks', async () => {
    const json = JSON.stringify({ msg: 'hello world' });
    const mid = Math.floor(json.length / 2);
    const result = await collect(
      parseJsonl(fromChunks([json.slice(0, mid), `${json.slice(mid)}\n`])),
    );
    expect(result).toEqual([{ msg: 'hello world' }]);
  });

  it('treats top-level arrays/primitives as raw (we expect objects)', async () => {
    const input = '[1,2,3]\n42\n';
    const result = await collect(parseJsonl(fromString(input)));
    expect(result).toEqual([{ __raw: '[1,2,3]' }, { __raw: '42' }]);
  });
});
