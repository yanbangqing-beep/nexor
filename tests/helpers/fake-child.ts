import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';

export interface FakeChildOpts {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}

/**
 * Build a stub ChildProcess for adapter unit tests.
 * Stdout is a Readable that yields the provided string and ends.
 * 'exit' event fires on a microtask after stdout drains.
 */
export function createFakeChild(opts: FakeChildOpts = {}): ChildProcess {
  const ee = new EventEmitter();
  let _exitCode: number | null = null;

  const stdoutSrc = opts.stdout ? [opts.stdout] : [];
  const stderrSrc = opts.stderr ? [opts.stderr] : [];
  const stdout = Readable.from(stdoutSrc);
  const stderr = Readable.from(stderrSrc);

  const child = ee as unknown as ChildProcess;
  Object.defineProperties(child, {
    stdout: { value: stdout, configurable: true },
    stderr: { value: stderr, configurable: true },
    stdin: { value: null, configurable: true },
    exitCode: { get: () => _exitCode, configurable: true },
    killed: { value: false, configurable: true, writable: true },
    pid: { value: 12345, configurable: true },
    kill: {
      value: (_signal?: string) => {
        if (_exitCode === null) {
          _exitCode = 130;
          setImmediate(() => ee.emit('exit', 130));
        }
        return true;
      },
      configurable: true,
    },
  });

  stdout.on('end', () => {
    setImmediate(() => {
      if (_exitCode === null) {
        _exitCode = opts.exitCode ?? 0;
        ee.emit('exit', _exitCode);
      }
    });
  });

  return child;
}
