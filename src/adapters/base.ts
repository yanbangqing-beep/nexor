import type { ChildProcess, SpawnOptions } from 'node:child_process';

export type SpawnFn = (command: string, args: string[], opts: SpawnOptions) => ChildProcess;

/**
 * Parse a stream of bytes/strings as newline-delimited JSON.
 * Yields parsed objects per line. Non-JSON lines are surfaced as { __raw: line }.
 */
export async function* parseJsonl(
  stream: AsyncIterable<Buffer | string>,
): AsyncIterable<Record<string, unknown>> {
  let buffer = '';
  for await (const chunk of stream) {
    buffer += typeof chunk === 'string' ? chunk : chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      yield tryParse(trimmed);
    }
  }
  const tail = buffer.trim();
  if (tail) yield tryParse(tail);
}

function tryParse(line: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(line);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { __raw: line };
  } catch {
    return { __raw: line };
  }
}

export async function* emptyAsync<T>(): AsyncIterable<T> {
  // no values
}

export function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; code?: string };
  return e.name === 'AbortError' || e.code === 'ABORT_ERR';
}

export async function awaitExit(child: ChildProcess): Promise<number> {
  if (child.exitCode !== null) return child.exitCode;
  return new Promise<number>((resolve) => {
    child.once('exit', (code) => resolve(code ?? 1));
  });
}

const DEFAULT_STDERR_CAP = 8192;

/**
 * Yield stderr lines as they arrive, in real time. Skips blank lines.
 * Stops yielding once the cumulative byte count of yielded text exceeds
 * `maxBytes`; the cap is total, not per-line.
 */
export async function* streamStderrLines(
  stream: NodeJS.ReadableStream | null,
  maxBytes: number = DEFAULT_STDERR_CAP,
): AsyncIterable<string> {
  if (!stream) return;
  let buf = '';
  let consumed = 0;
  let capped = false;

  for await (const chunk of stream as AsyncIterable<Buffer | string>) {
    if (capped) continue;
    buf += typeof chunk === 'string' ? chunk : chunk.toString();
    let nl = buf.indexOf('\n');
    while (nl >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) {
        if (consumed + line.length > maxBytes) {
          capped = true;
          break;
        }
        consumed += line.length;
        yield line;
      }
      nl = buf.indexOf('\n');
    }
  }
  const tail = buf.trim();
  if (tail && !capped && consumed + tail.length <= maxBytes) yield tail;
}

/**
 * Merge two async iterables, tagging each yielded value with its source.
 * Reads both concurrently and emits whichever has a value ready first,
 * which preserves real-time ordering between the streams.
 */
export async function* mergeTagged<S, E>(
  stdout: AsyncIterable<S>,
  stderr: AsyncIterable<E>,
): AsyncIterable<{ src: 'stdout'; value: S } | { src: 'stderr'; value: E }> {
  const stdoutIter = stdout[Symbol.asyncIterator]();
  const stderrIter = stderr[Symbol.asyncIterator]();

  let stdoutDone = false;
  let stderrDone = false;
  let stdoutPromise: Promise<{ src: 'stdout'; result: IteratorResult<S> }> | null = stdoutIter
    .next()
    .then((result) => ({ src: 'stdout' as const, result }));
  let stderrPromise: Promise<{ src: 'stderr'; result: IteratorResult<E> }> | null = stderrIter
    .next()
    .then((result) => ({ src: 'stderr' as const, result }));

  while (!stdoutDone || !stderrDone) {
    const racers: Promise<unknown>[] = [];
    if (stdoutPromise) racers.push(stdoutPromise);
    if (stderrPromise) racers.push(stderrPromise);
    const winner = (await Promise.race(racers)) as
      | { src: 'stdout'; result: IteratorResult<S> }
      | { src: 'stderr'; result: IteratorResult<E> };

    if (winner.src === 'stdout') {
      if (winner.result.done) {
        stdoutDone = true;
        stdoutPromise = null;
      } else {
        yield { src: 'stdout', value: winner.result.value };
        stdoutPromise = stdoutIter.next().then((result) => ({ src: 'stdout' as const, result }));
      }
    } else {
      if (winner.result.done) {
        stderrDone = true;
        stderrPromise = null;
      } else {
        yield { src: 'stderr', value: winner.result.value };
        stderrPromise = stderrIter.next().then((result) => ({ src: 'stderr' as const, result }));
      }
    }
  }
}
