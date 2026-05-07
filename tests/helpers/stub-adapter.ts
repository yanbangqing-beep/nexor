import type { Adapter, AgentEvent, AgentName, ExecOpts } from '../../src/types.js';

/**
 * Stub adapter for runner tests. Yields a fixed sequence of events.
 * Honors AbortSignal between yields.
 */
export function createStubAdapter(
  name: AgentName,
  events: AgentEvent[],
  opts: { delayMs?: number } = {},
): Adapter {
  return {
    name,
    async *exec(execOpts: ExecOpts): AsyncIterable<AgentEvent> {
      for (const evt of events) {
        if (opts.delayMs && opts.delayMs > 0) {
          await new Promise<void>((resolve, reject) => {
            const t = setTimeout(resolve, opts.delayMs);
            execOpts.signal.addEventListener('abort', () => {
              clearTimeout(t);
              reject(new DOMException('aborted', 'AbortError'));
            });
          });
        }
        if (execOpts.signal.aborted) {
          throw new DOMException('aborted', 'AbortError');
        }
        yield evt;
      }
    },
  };
}
