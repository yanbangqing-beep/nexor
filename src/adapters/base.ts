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

export async function awaitExit(child: ChildProcess): Promise<number> {
  if (child.exitCode !== null) return child.exitCode;
  return new Promise<number>((resolve) => {
    child.once('exit', (code) => resolve(code ?? 1));
  });
}

const DEFAULT_STDERR_CAP = 8192;

/**
 * Drain a child's stderr concurrently with stdout consumption. Buffers up to
 * `maxBytes` and appends a truncation marker if the limit is hit. Returns the
 * trimmed tail; empty string if nothing was emitted.
 */
export function drainStderr(
  stream: NodeJS.ReadableStream | null,
  maxBytes: number = DEFAULT_STDERR_CAP,
): Promise<string> {
  if (!stream) return Promise.resolve('');
  return new Promise<string>((resolve) => {
    let buf = '';
    let truncated = false;
    stream.on('data', (chunk: Buffer | string) => {
      if (truncated) return;
      const text = typeof chunk === 'string' ? chunk : chunk.toString();
      if (buf.length + text.length <= maxBytes) {
        buf += text;
      } else {
        buf += text.slice(0, Math.max(0, maxBytes - buf.length));
        truncated = true;
      }
    });
    const finish = () => {
      const tail = truncated ? `${buf}\n[stderr truncated]` : buf;
      resolve(tail.trim());
    };
    stream.once('end', finish);
    stream.once('close', finish);
    stream.once('error', finish);
  });
}
