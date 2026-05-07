import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LockBusyError, acquireLock } from '../src/process/lock.js';

let tmpDir: string;
let lockPath: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexor-test-'));
  lockPath = path.join(tmpDir, 'nexor.lock');
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function findDeadPid(): Promise<number> {
  for (let p = 99991; p < 999999; p++) {
    try {
      process.kill(p, 0);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ESRCH') return p;
    }
  }
  throw new Error('No dead PID found in scan range');
}

describe('acquireLock', () => {
  it('acquires when no lock file exists and writes our PID', async () => {
    const handle = await acquireLock(lockPath);
    const written = await fs.readFile(lockPath, 'utf-8');
    expect(Number.parseInt(written, 10)).toBe(process.pid);
    await handle.release();
  });

  it('refuses when lock file contains a live PID', async () => {
    await fs.writeFile(lockPath, String(process.pid));
    await expect(acquireLock(lockPath)).rejects.toThrow(LockBusyError);
  });

  it('reclaims when lock file contains a stale (dead) PID', async () => {
    const deadPid = await findDeadPid();
    await fs.writeFile(lockPath, String(deadPid));
    const handle = await acquireLock(lockPath);
    const written = await fs.readFile(lockPath, 'utf-8');
    expect(Number.parseInt(written, 10)).toBe(process.pid);
    await handle.release();
  });

  it('reclaims when lock file is malformed (non-numeric)', async () => {
    await fs.writeFile(lockPath, 'not a number');
    const handle = await acquireLock(lockPath);
    const written = await fs.readFile(lockPath, 'utf-8');
    expect(Number.parseInt(written, 10)).toBe(process.pid);
    await handle.release();
  });

  it('release removes the lock file', async () => {
    const handle = await acquireLock(lockPath);
    await handle.release();
    await expect(fs.access(lockPath)).rejects.toThrow();
  });

  it('release does not delete a lock file owned by another PID', async () => {
    const handle = await acquireLock(lockPath);
    // Simulate another process taking over
    await fs.writeFile(lockPath, '999999');
    await handle.release();
    // File should still exist (we did not delete someone else's lock)
    const after = await fs.readFile(lockPath, 'utf-8');
    expect(after).toBe('999999');
  });

  it('LockBusyError exposes the offending PID', async () => {
    await fs.writeFile(lockPath, String(process.pid));
    try {
      await acquireLock(lockPath);
      expect.fail('expected LockBusyError');
    } catch (err) {
      expect(err).toBeInstanceOf(LockBusyError);
      expect((err as LockBusyError).pid).toBe(process.pid);
    }
  });
});
