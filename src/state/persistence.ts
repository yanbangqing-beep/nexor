import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { AgentName, Session, SessionStatus } from '../types.js';

export async function loadSessions(filePath: string): Promise<Session[]> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isSession);
}

export interface DebouncedWriter {
  write(sessions: Session[]): void;
  flush(): Promise<void>;
}

export function createDebouncedWriter(filePath: string, delayMs: number): DebouncedWriter {
  let timer: NodeJS.Timeout | null = null;
  let pending: Session[] | null = null;
  let inflight: Promise<void> | null = null;

  const performWrite = async (): Promise<void> => {
    timer = null;
    const toWrite = pending;
    pending = null;
    if (!toWrite) return;
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(toWrite, null, 2));
    await fs.rename(tmp, filePath);
  };

  return {
    write(sessions) {
      pending = sessions;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        inflight = performWrite();
      }, delayMs);
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
        inflight = performWrite();
      }
      if (inflight) {
        await inflight;
        inflight = null;
      }
    },
  };
}

const VALID_AGENTS: AgentName[] = ['claude', 'codex'];
const VALID_STATUSES: SessionStatus[] = ['idle', 'working', 'done', 'error'];

function isSession(o: unknown): o is Session {
  if (!o || typeof o !== 'object') return false;
  const s = o as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.label === 'string' &&
    typeof s.cwd === 'string' &&
    typeof s.createdAt === 'number' &&
    typeof s.lastActivity === 'number' &&
    typeof s.messageCount === 'number' &&
    VALID_AGENTS.includes(s.agent as AgentName) &&
    VALID_STATUSES.includes(s.status as SessionStatus)
  );
}
