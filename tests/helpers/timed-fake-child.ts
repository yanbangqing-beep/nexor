import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';

export interface TimedEmission {
  at: number; // ms after spawn
  text: string;
}

export interface TimedFakeChildOpts {
  stdoutSchedule?: TimedEmission[];
  stderrSchedule?: TimedEmission[];
  exitAt?: number;
  exitCode?: number;
}

/**
 * Like createFakeChild but stdout/stderr emit on a schedule (delays in ms),
 * so adapter behaviour around concurrent stream consumption is observable.
 */
export function createTimedFakeChild(opts: TimedFakeChildOpts = {}): ChildProcess {
  const start = Date.now();
  const ee = new EventEmitter();
  let exitCode: number | null = null;

  const stdout = Readable.from(timedSchedule(opts.stdoutSchedule ?? [], start));
  const stderr = Readable.from(timedSchedule(opts.stderrSchedule ?? [], start));

  const child = ee as unknown as ChildProcess;
  Object.defineProperties(child, {
    stdout: { value: stdout, configurable: true },
    stderr: { value: stderr, configurable: true },
    stdin: { value: null, configurable: true },
    exitCode: { get: () => exitCode, configurable: true },
    killed: { value: false, configurable: true, writable: true },
    pid: { value: 12346, configurable: true },
    kill: {
      value: () => {
        if (exitCode === null) {
          exitCode = 130;
          setImmediate(() => ee.emit('exit', 130));
        }
        return true;
      },
      configurable: true,
    },
  });

  const exitAt = opts.exitAt ?? 0;
  setTimeout(() => {
    if (exitCode === null) {
      exitCode = opts.exitCode ?? 0;
      ee.emit('exit', exitCode);
    }
  }, exitAt);

  return child;
}

async function* timedSchedule(items: TimedEmission[], start: number): AsyncIterable<string> {
  for (const item of items) {
    const wait = Math.max(0, start + item.at - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    yield item.text;
  }
}
