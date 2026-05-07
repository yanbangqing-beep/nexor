import { randomUUID } from 'node:crypto';
import type { AgentName, Session } from '../types.js';

export interface CreateSessionInput {
  agent: AgentName;
  label: string;
  cwd: string;
}

export interface SessionStore {
  list(): Session[];
  get(id: string): Session | undefined;
  create(input: CreateSessionInput): Session;
  update(id: string, patch: Partial<Session>): void;
  delete(id: string): boolean;
  subscribe(listener: () => void): () => void;
}

export function createSessionStore(initial: Session[] = []): SessionStore {
  const sessions = new Map<string, Session>(initial.map((s) => [s.id, s]));
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const l of listeners) l();
  };

  return {
    list() {
      return Array.from(sessions.values());
    },
    get(id) {
      return sessions.get(id);
    },
    create(input) {
      const now = Date.now();
      const session: Session = {
        id: randomUUID(),
        agent: input.agent,
        label: input.label,
        cwd: input.cwd,
        status: 'idle',
        createdAt: now,
        lastActivity: now,
        messageCount: 0,
      };
      sessions.set(session.id, session);
      notify();
      return session;
    },
    update(id, patch) {
      const existing = sessions.get(id);
      if (!existing) return;
      sessions.set(id, { ...existing, ...patch, lastActivity: Date.now() });
      notify();
    },
    delete(id) {
      const removed = sessions.delete(id);
      if (removed) notify();
      return removed;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
