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

export interface ClaudeAdapterOpts {
  binary?: string;
  spawn?: SpawnFn;
}

export function createClaudeAdapter(opts: ClaudeAdapterOpts = {}): Adapter {
  const binary = opts.binary ?? 'claude';
  const spawn = opts.spawn ?? defaultSpawn;

  return {
    name: 'claude',
    async *exec(execOpts: ExecOpts): AsyncIterable<AgentEvent> {
      const args = buildClaudeArgs(execOpts);
      const child = spawn(binary, args, { cwd: execOpts.cwd, signal: execOpts.signal });
      const stdoutLines = child.stdout
        ? parseJsonl(child.stdout)
        : emptyAsync<Record<string, unknown>>();
      const stderrLines = streamStderrLines(child.stderr);
      let sessionEmitted = false;

      try {
        for await (const item of mergeTagged(stdoutLines, stderrLines)) {
          if (item.src === 'stdout') {
            for (const out of normalizeClaudeEvent(item.value, sessionEmitted)) {
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

      const exitCode = await awaitExit(child);
      yield { type: 'done', exitCode };
    },
  };
}

export function buildClaudeArgs(opts: ExecOpts): string[] {
  const args = [
    '-p',
    opts.prompt,
    '--output-format',
    'stream-json',
    '--verbose',
    '--dangerously-skip-permissions',
  ];
  if (opts.agentSessionId) args.push('--resume', opts.agentSessionId);
  return args;
}

export function normalizeClaudeEvent(
  evt: Record<string, unknown>,
  sessionAlreadyEmitted: boolean,
): AgentEvent[] {
  const out: AgentEvent[] = [];

  if (typeof evt.__raw === 'string') {
    out.push({ type: 'output', text: evt.__raw });
    return out;
  }

  if (typeof evt.session_id === 'string' && !sessionAlreadyEmitted) {
    out.push({ type: 'session', id: evt.session_id });
  }

  const text = extractText(evt);
  if (text) out.push({ type: 'output', text });
  return out;
}

function extractText(evt: Record<string, unknown>): string | null {
  if (evt.type === 'assistant' && isObject(evt.message)) {
    const content = (evt.message as Record<string, unknown>).content;
    if (Array.isArray(content)) {
      const parts: string[] = [];
      for (const c of content) {
        if (!isObject(c)) continue;
        const co = c as Record<string, unknown>;
        if (co.type === 'text' && typeof co.text === 'string') {
          parts.push(co.text);
        } else if (co.type === 'tool_use' && typeof co.name === 'string') {
          parts.push(`[tool: ${co.name}]`);
        }
      }
      if (parts.length > 0) return parts.join('\n');
    }
  }

  // `result` events recap the final assistant text — emitting them would
  // duplicate the answer the user already saw streamed via `assistant`.
  return null;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
