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
      const exitPromise = awaitExit(child);
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
            if (isCodexStderrNoise(item.value)) continue;
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
    // codex prints a non-JSON "Shell cwd was reset to ..." line at the very
    // end of stdout. Filter it so it doesn't pollute the transcript.
    if (evt.__raw.startsWith('Shell cwd was reset')) return out;
    out.push({ type: 'output', text: evt.__raw });
    return out;
  }

  // codex --json identifies a conversation via `thread_id` on `thread.started`.
  // We also accept a legacy `session_id` field for forward/backward safety.
  const sessionId =
    typeof evt.thread_id === 'string'
      ? evt.thread_id
      : typeof evt.session_id === 'string'
        ? evt.session_id
        : null;
  if (sessionId && !sessionAlreadyEmitted) {
    out.push({ type: 'session', id: sessionId });
  }

  const text = extractText(evt);
  if (text) out.push({ type: 'output', text });
  return out;
}

function extractText(evt: Record<string, unknown>): string | null {
  if (evt.type === 'item.completed' && isObject(evt.item)) {
    const item = evt.item as Record<string, unknown>;
    if (item.type === 'agent_message' && typeof item.text === 'string') {
      return item.text;
    }
    if (item.type === 'command_execution' && typeof item.command === 'string') {
      const exitCode = typeof item.exit_code === 'number' ? item.exit_code : null;
      const status = exitCode !== null ? `exit ${exitCode}` : 'completed';
      return `[exec ${status}] ${item.command}`;
    }
  }
  return null;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// codex prints chatter on stderr that doesn't indicate a real failure but
// pollutes the transcript when surfaced via stderr passthrough.
const CODEX_STDERR_NOISE = [
  /^Reading additional input from stdin/,
  /codex_models_manager::manager: failed to refresh available models/,
];

export function isCodexStderrNoise(line: string): boolean {
  return CODEX_STDERR_NOISE.some((p) => p.test(line));
}
