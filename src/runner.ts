import type { AdapterRegistry } from './adapters/registry.js';
import type { OutputStore } from './state/outputs.js';
import type { SessionStore } from './state/store.js';

export interface RunnerDeps {
  store: SessionStore;
  outputs: OutputStore;
  adapters: AdapterRegistry;
}

export interface Runner {
  run(sessionId: string, prompt: string): Promise<void>;
  isRunning(sessionId: string): boolean;
  cancel(sessionId: string): void;
  cancelAll(): void;
  reset(sessionId: string): void;
  delete(sessionId: string): boolean;
}

export class SessionBusyError extends Error {
  constructor() {
    super('session is busy');
    this.name = 'SessionBusyError';
  }
}

export class SessionNotFoundError extends Error {
  constructor(id: string) {
    super(`session ${id} not found`);
    this.name = 'SessionNotFoundError';
  }
}

export class AdapterMissingError extends Error {
  constructor(agent: string) {
    super(`no adapter for ${agent}`);
    this.name = 'AdapterMissingError';
  }
}

export function createRunner(deps: RunnerDeps): Runner {
  const inflight = new Map<string, AbortController>();

  return {
    isRunning(sessionId) {
      return inflight.has(sessionId);
    },
    cancel(sessionId) {
      inflight.get(sessionId)?.abort();
    },
    cancelAll() {
      for (const ac of inflight.values()) ac.abort();
    },
    reset(sessionId) {
      this.cancel(sessionId);
      deps.store.update(sessionId, { agentSessionId: undefined });
      deps.outputs.clear(sessionId);
    },
    delete(sessionId) {
      this.cancel(sessionId);
      const removed = deps.store.delete(sessionId);
      if (removed) deps.outputs.delete(sessionId);
      return removed;
    },
    async run(sessionId, prompt) {
      if (inflight.has(sessionId)) throw new SessionBusyError();

      const session = deps.store.get(sessionId);
      if (!session) throw new SessionNotFoundError(sessionId);

      const adapter = deps.adapters[session.agent];
      if (!adapter) throw new AdapterMissingError(session.agent);

      const ac = new AbortController();
      inflight.set(sessionId, ac);

      deps.store.update(sessionId, { status: 'working', errorMessage: undefined });
      deps.outputs.append(sessionId, `\n> ${prompt}\n`);

      try {
        for await (const evt of adapter.exec({
          prompt,
          agentSessionId: session.agentSessionId,
          cwd: session.cwd,
          signal: ac.signal,
        })) {
          if (evt.type === 'output') {
            deps.outputs.append(sessionId, `${evt.text}\n`);
          } else if (evt.type === 'session') {
            deps.store.update(sessionId, { agentSessionId: evt.id });
          } else if (evt.type === 'done') {
            const cur = deps.store.get(sessionId);
            deps.store.update(sessionId, {
              status: evt.exitCode === 0 ? 'done' : 'error',
              messageCount: (cur?.messageCount ?? 0) + 1,
            });
          }
        }
      } catch (err) {
        if (ac.signal.aborted) {
          deps.store.update(sessionId, { status: 'idle' });
          deps.outputs.append(sessionId, '\n[cancelled]\n');
        } else {
          const message = (err as Error).message ?? String(err);
          deps.store.update(sessionId, { status: 'error', errorMessage: message });
          deps.outputs.append(sessionId, `\n[error] ${message}\n`);
        }
      } finally {
        inflight.delete(sessionId);
      }
    },
  };
}
