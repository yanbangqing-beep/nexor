import { defaultSpawn } from '../process/spawn.js';
import type { Adapter, AgentEvent, ExecOpts } from '../types.js';
import {
  type SpawnFn,
  awaitExit,
  emptyAsync,
  isAbortError,
  mergeTagged,
  parseJsonl,
  streamStderrLines,
} from './base.js';

export interface AliceAdapterOpts {
  binary?: string;
  spawn?: SpawnFn;
}

export function createAliceAdapter(opts: AliceAdapterOpts = {}): Adapter {
  const binary = opts.binary ?? 'alice';
  const spawn = opts.spawn ?? defaultSpawn;

  return {
    name: 'alice',
    async *exec(execOpts: ExecOpts): AsyncIterable<AgentEvent> {
      const args = buildAliceArgs(execOpts);
      const child = spawn(binary, args, { cwd: execOpts.cwd, signal: execOpts.signal });
      const exitPromise = awaitExit(child);
      const stdoutLines = child.stdout
        ? parseJsonl(child.stdout)
        : emptyAsync<Record<string, unknown>>();
      const stderrLines = streamStderrLines(child.stderr);
      let sessionEmitted = false;

      try {
        for await (const item of mergeTagged(stdoutLines, stderrLines)) {
          if (item.src === 'stdout') {
            for (const out of normalizeAliceEvent(item.value, sessionEmitted)) {
              if (out.type === 'session') sessionEmitted = true;
              yield out;
            }
          } else {
            yield { type: 'stderr', text: item.value };
          }
        }
      } catch (err) {
        if (!isAbortError(err)) throw err;
      }

      const exitCode = await exitPromise;
      yield { type: 'done', exitCode };
    },
  };
}

export function buildAliceArgs(opts: ExecOpts): string[] {
  const args = ['exec', '--json', '--cwd', opts.cwd];
  if (opts.agentSessionId) {
    args.push('--session', opts.agentSessionId);
  }
  args.push(opts.prompt);
  return args;
}

export function normalizeAliceEvent(
  evt: Record<string, unknown>,
  sessionAlreadyEmitted: boolean,
): AgentEvent[] {
  const out: AgentEvent[] = [];

  if (typeof evt.__raw === 'string') {
    out.push({ type: 'output', text: evt.__raw });
    return out;
  }

  const sessionId =
    typeof evt.session_id === 'string'
      ? evt.session_id
      : typeof evt.sessionId === 'string'
        ? evt.sessionId
        : null;
  if (sessionId && !sessionAlreadyEmitted) {
    out.push({ type: 'session', id: sessionId });
  }

  const text = extractText(evt);
  if (text) out.push({ type: 'output', text });
  return out;
}

function extractText(evt: Record<string, unknown>): string | null {
  if (evt.type === 'agent_message' && typeof evt.text === 'string') {
    return evt.text;
  }
  if (evt.type === 'thinking' && typeof evt.text === 'string') {
    return evt.text;
  }
  if (evt.type === 'tool_call' && typeof evt.name === 'string') {
    return `[tool: ${evt.name}]`;
  }
  if (evt.type === 'tool_result' && evt.is_error === true && typeof evt.content === 'string') {
    return `[tool error] ${evt.content}`;
  }
  if (evt.type === 'error' && typeof evt.message === 'string') {
    return `[error] ${evt.message}`;
  }
  return null;
}
