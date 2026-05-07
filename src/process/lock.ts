import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface LockHandle {
  release(): Promise<void>;
}

export class LockBusyError extends Error {
  constructor(public readonly pid: number) {
    super(`nexor is already running (pid ${pid})`);
    this.name = 'LockBusyError';
  }
}

export async function acquireLock(filePath: string): Promise<LockHandle> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  // Check existing lock; if its PID is still alive, refuse. Otherwise reclaim.
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const pid = Number.parseInt(raw.trim(), 10);
    if (!Number.isNaN(pid) && isPidAlive(pid)) {
      throw new LockBusyError(pid);
    }
    await fs.unlink(filePath).catch(() => undefined);
  } catch (err) {
    if (err instanceof LockBusyError) throw err;
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  // Atomic create-only write; if EEXIST, someone raced us — re-check.
  try {
    await fs.writeFile(filePath, String(process.pid), { flag: 'wx' });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
      const raw = await fs.readFile(filePath, 'utf-8');
      const pid = Number.parseInt(raw.trim(), 10);
      throw new LockBusyError(Number.isNaN(pid) ? -1 : pid);
    }
    throw err;
  }

  let released = false;
  return {
    async release() {
      if (released) return;
      released = true;
      try {
        const raw = await fs.readFile(filePath, 'utf-8');
        if (Number.parseInt(raw.trim(), 10) === process.pid) {
          await fs.unlink(filePath);
        }
      } catch {
        /* best effort */
      }
    },
  };
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM = process exists but we can't signal it (still alive)
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}
