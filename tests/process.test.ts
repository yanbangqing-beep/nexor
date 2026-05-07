import { describe, expect, it } from 'vitest';
import { awaitExit } from '../src/adapters/base.js';
import { defaultSpawn } from '../src/process/spawn.js';

describe('defaultSpawn', () => {
  it('launches a real subprocess and captures stdout', async () => {
    const ac = new AbortController();
    const child = defaultSpawn('node', ['-e', 'process.stdout.write("hello")'], {
      cwd: process.cwd(),
      signal: ac.signal,
    });

    let collected = '';
    if (child.stdout) {
      for await (const chunk of child.stdout) collected += chunk.toString();
    }
    const code = await awaitExit(child);
    expect(collected).toBe('hello');
    expect(code).toBe(0);
  });

  it('passes cwd through to the child process', async () => {
    const ac = new AbortController();
    const child = defaultSpawn('node', ['-e', 'process.stdout.write(process.cwd())'], {
      cwd: '/tmp',
      signal: ac.signal,
    });
    let collected = '';
    if (child.stdout) {
      for await (const chunk of child.stdout) collected += chunk.toString();
    }
    await awaitExit(child);
    // /tmp may resolve to /private/tmp on macOS; both end in /tmp
    expect(collected.endsWith('/tmp')).toBe(true);
  });
});
