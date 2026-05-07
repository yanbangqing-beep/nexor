import { type ChildProcess, type SpawnOptions, spawn as nodeSpawn } from 'node:child_process';
import type { SpawnFn } from '../adapters/base.js';

/**
 * Default SpawnFn — wraps node's child_process.spawn with sensible stdio defaults.
 * Adapters receive this via dependency injection so tests can substitute fakes.
 */
export const defaultSpawn: SpawnFn = (
  command: string,
  args: string[],
  opts: SpawnOptions,
): ChildProcess => {
  return nodeSpawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  });
};
