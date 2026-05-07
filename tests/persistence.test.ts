import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDebouncedWriter, loadSessions } from '../src/state/persistence.js';
import type { Session } from '../src/types.js';

let tmpDir: string;
let filePath: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexor-test-'));
  filePath = path.join(tmpDir, 'sessions.json');
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

const sample: Session = {
  id: 'a',
  agent: 'claude',
  label: 'l',
  cwd: '/c',
  status: 'idle',
  createdAt: 1,
  lastActivity: 1,
  messageCount: 0,
};

describe('loadSessions', () => {
  it('returns empty array when file does not exist', async () => {
    expect(await loadSessions(filePath)).toEqual([]);
  });

  it('returns empty array when file is malformed JSON', async () => {
    await fs.writeFile(filePath, '{not json}');
    expect(await loadSessions(filePath)).toEqual([]);
  });

  it('returns empty when top-level is not an array', async () => {
    await fs.writeFile(filePath, JSON.stringify({ sessions: [sample] }));
    expect(await loadSessions(filePath)).toEqual([]);
  });

  it('round-trips a written session list', async () => {
    await fs.writeFile(filePath, JSON.stringify([sample]));
    const loaded = await loadSessions(filePath);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('a');
    expect(loaded[0].agent).toBe('claude');
  });

  it('filters out malformed entries while keeping valid ones', async () => {
    await fs.writeFile(filePath, JSON.stringify([sample, { foo: 'bar' }, null, sample]));
    const loaded = await loadSessions(filePath);
    expect(loaded).toHaveLength(2);
  });

  it('rejects entries with invalid agent name', async () => {
    const bad = { ...sample, agent: 'gpt5' };
    await fs.writeFile(filePath, JSON.stringify([bad]));
    expect(await loadSessions(filePath)).toEqual([]);
  });
});

describe('createDebouncedWriter', () => {
  it('writes after the debounce delay', async () => {
    const writer = createDebouncedWriter(filePath, 30);
    writer.write([sample]);
    await new Promise((r) => setTimeout(r, 80));
    await writer.flush();
    const loaded = await loadSessions(filePath);
    expect(loaded).toHaveLength(1);
  });

  it('coalesces multiple writes within the debounce window into one', async () => {
    const writer = createDebouncedWriter(filePath, 50);
    writer.write([sample]);
    writer.write([sample, { ...sample, id: 'b' }]);
    writer.write([sample, { ...sample, id: 'b' }, { ...sample, id: 'c' }]);
    await writer.flush();
    const loaded = await loadSessions(filePath);
    expect(loaded).toHaveLength(3);
  });

  it('flush forces immediate write even when debounce is long', async () => {
    const writer = createDebouncedWriter(filePath, 5000);
    writer.write([sample]);
    await writer.flush();
    expect(await loadSessions(filePath)).toHaveLength(1);
  });

  it('creates parent directory if missing', async () => {
    const nested = path.join(tmpDir, 'deep', 'nested', 'sessions.json');
    const writer = createDebouncedWriter(nested, 10);
    writer.write([sample]);
    await writer.flush();
    expect(await loadSessions(nested)).toHaveLength(1);
  });

  it('uses atomic temp+rename so partial writes are not visible', async () => {
    const writer = createDebouncedWriter(filePath, 10);
    writer.write([sample]);
    await writer.flush();
    // After flush, no .tmp file should remain
    const files = await fs.readdir(path.dirname(filePath));
    expect(files).not.toContain('sessions.json.tmp');
  });
});
