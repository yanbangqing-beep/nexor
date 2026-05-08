import { type ChildProcess, type SpawnOptions, spawn as nodeSpawn } from 'node:child_process';
import type { SpawnFn } from '../adapters/base.js';

export const DEFAULT_KILL_GRACE_MS = 3000;

/**
 * Spawn a child process with SIGTERM → grace → SIGKILL escalation
 * driven by an optional AbortSignal. We do NOT pass the signal directly
 * to node's spawn (which would only ever send SIGTERM); we manage abort
 * ourselves so the grace period is observable and configurable.
 */
export function spawnWithGrace(
  command: string,
  args: string[],
  opts: SpawnOptions,
  graceMs: number,
): ChildProcess {
  const { signal, ...rest } = opts;
  const child = nodeSpawn(command, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    ...rest,
  });

  // Some agents (e.g. claude -p) keep reading stdin until EOF even when the
  // prompt is given as an argument. /dev/null via 'ignore' isn't always
  // enough — explicitly close the writable side so the child sees end-of-input
  // immediately and proceeds.
  child.stdin?.end();

  if (signal) {
    const onAbort = () => escalateKill(child, graceMs);
    if (signal.aborted) {
      onAbort();
    } else {
      signal.addEventListener('abort', onAbort, { once: true });
      child.once('exit', () => signal.removeEventListener('abort', onAbort));
    }
  }

  return child;
}

function escalateKill(child: ChildProcess, graceMs: number) {
  if (child.killed || child.exitCode !== null) return;
  try {
    child.kill('SIGTERM');
  } catch {
    return;
  }
  const t = setTimeout(() => {
    if (child.exitCode === null) {
      try {
        child.kill('SIGKILL');
      } catch {
        /* may have just exited */
      }
    }
  }, graceMs);
  t.unref();
}

export const defaultSpawn: SpawnFn = (
  command: string,
  args: string[],
  opts: SpawnOptions,
): ChildProcess => spawnWithGrace(command, args, opts, DEFAULT_KILL_GRACE_MS);
