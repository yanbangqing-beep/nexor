import { describe, expect, it } from 'vitest';
import { createSessionStore } from '../src/state/store.js';
import type { Session } from '../src/types.js';

describe('SessionStore', () => {
  it('starts empty by default', () => {
    const store = createSessionStore();
    expect(store.list()).toEqual([]);
  });

  it('hydrates from initial sessions', () => {
    const initial: Session[] = [
      {
        id: 'x',
        agent: 'claude',
        label: 'l',
        cwd: '/c',
        status: 'idle',
        createdAt: 0,
        lastActivity: 0,
        messageCount: 0,
      },
    ];
    const store = createSessionStore(initial);
    expect(store.list()).toHaveLength(1);
    expect(store.get('x')?.label).toBe('l');
  });

  it('creates a session with auto-generated id, idle status', () => {
    const store = createSessionStore();
    const s = store.create({ agent: 'claude', label: 'test', cwd: '/tmp' });
    expect(s.id.length).toBeGreaterThan(8);
    expect(s.status).toBe('idle');
    expect(s.messageCount).toBe(0);
    expect(store.list()).toHaveLength(1);
  });

  it('updates a session by id and bumps lastActivity', async () => {
    const store = createSessionStore();
    const s = store.create({ agent: 'claude', label: 'test', cwd: '/tmp' });
    const original = s.lastActivity;
    await new Promise((r) => setTimeout(r, 5));
    store.update(s.id, { status: 'working' });
    const updated = store.get(s.id);
    expect(updated?.status).toBe('working');
    expect(updated?.lastActivity).toBeGreaterThan(original);
  });

  it('ignores updates to nonexistent ids', () => {
    const store = createSessionStore();
    store.update('nope', { status: 'working' });
    expect(store.list()).toHaveLength(0);
  });

  it('deletes a session and reports whether anything was removed', () => {
    const store = createSessionStore();
    const s = store.create({ agent: 'claude', label: 'test', cwd: '/tmp' });
    expect(store.delete(s.id)).toBe(true);
    expect(store.list()).toHaveLength(0);
    expect(store.delete(s.id)).toBe(false);
  });

  it('notifies subscribers on create / update / delete', () => {
    const store = createSessionStore();
    let count = 0;
    store.subscribe(() => count++);
    const s = store.create({ agent: 'claude', label: 'l', cwd: '/c' });
    expect(count).toBe(1);
    store.update(s.id, { status: 'done' });
    expect(count).toBe(2);
    store.delete(s.id);
    expect(count).toBe(3);
  });

  it('unsubscribe stops further notifications', () => {
    const store = createSessionStore();
    let count = 0;
    const unsub = store.subscribe(() => count++);
    store.create({ agent: 'claude', label: 'l', cwd: '/c' });
    expect(count).toBe(1);
    unsub();
    store.create({ agent: 'codex', label: 'l2', cwd: '/c' });
    expect(count).toBe(1);
  });
});
