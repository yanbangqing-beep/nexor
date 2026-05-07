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
