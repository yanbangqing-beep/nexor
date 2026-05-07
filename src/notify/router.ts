import type { SessionStore } from '../state/store.js';
import type { Session, SessionStatus } from '../types.js';

export interface NotificationEvent {
  session: Session;
  type: 'done' | 'error';
  timestamp: number;
}

export interface NotificationRouter {
  subscribe(listener: (evt: NotificationEvent) => void): () => void;
  lastEvent(): NotificationEvent | null;
}

/**
 * Monitors session store transitions and emits events when any session
 * moves from 'working' to 'done' or 'error'.
 */
export function createNotificationRouter(store: SessionStore): NotificationRouter {
  let snapshot = new Map<string, SessionStatus>();
  const listeners = new Set<(evt: NotificationEvent) => void>();
  let last: NotificationEvent | null = null;

  for (const s of store.list()) snapshot.set(s.id, s.status);

  store.subscribe(() => {
    const current = store.list();
    for (const s of current) {
      const prev = snapshot.get(s.id);
      if (prev === 'working' && (s.status === 'done' || s.status === 'error')) {
        const evt: NotificationEvent = { session: s, type: s.status, timestamp: Date.now() };
        last = evt;
        for (const l of listeners) l(evt);
      }
    }
    snapshot = new Map(current.map((s) => [s.id, s.status]));
  });

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    lastEvent() {
      return last;
    },
  };
}
