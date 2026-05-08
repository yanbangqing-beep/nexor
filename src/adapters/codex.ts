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

export interface CodexAdapterOpts {
  binary?: string;
  spawn?: SpawnFn;
}

export function createCodexAdapter(opts: CodexAdapterOpts = {}): Adapter {
  const binary = opts.binary ?? 'codex';
  const spawn = opts.spawn ?? defaultSpawn;

  return {
    name: 'codex',
    async *exec(execOpts: ExecOpts): AsyncIterable<AgentEvent> {
      const args = buildCodexArgs(execOpts);
      const child = spawn(binary, args, { cwd: execOpts.cwd, signal: execOpts.signal });
      const stdoutLines = child.stdout
        ? parseJsonl(child.stdout)
        : emptyAsync<Record<string, unknown>>();
      const stderrLines = streamStderrLines(child.stderr);
      let sessionEmitted = false;

      try {
        for await (const item of mergeTagged(stdoutLines, stderrLines)) {
          if (item.src === 'stdout') {
            for (const out of normalizeCodexEvent(item.value, sessionEmitted)) {
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

export function buildCodexArgs(opts: ExecOpts): string[] {
  const args: string[] = ['exec'];
  if (opts.agentSessionId) {
    args.push('resume', opts.agentSessionId);
  }
  args.push(
    '--json',
    '--dangerously-bypass-approvals-and-sandbox',
    '--skip-git-repo-check',
    opts.prompt,
  );
  return args;
}

export function normalizeCodexEvent(
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
  if (evt.type === 'message' && typeof evt.content === 'string') {
    return evt.content;
  }
  if (evt.type === 'tool_call' && typeof evt.name === 'string') {
    return `[tool: ${evt.name}]`;
  }
  if (evt.type === 'result' && typeof evt.output === 'string') {
    return evt.output;
  }
  return null;
}
