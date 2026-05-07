import { describe, expect, it } from 'vitest';
import { createNotificationRouter } from '../src/notify/router.js';
import { createSessionStore } from '../src/state/store.js';

describe('createNotificationRouter', () => {
  it('emits event when a session transitions working → done', () => {
    const store = createSessionStore();
    const router = createNotificationRouter(store);
    const events: Parameters<Parameters<typeof router.subscribe>[0]>[] = [];
    router.subscribe((evt) => events.push([evt]));

    const s = store.create({ agent: 'claude', label: 'test', cwd: '/tmp' });
    store.update(s.id, { status: 'working' });
    store.update(s.id, { status: 'done' });

    expect(events).toHaveLength(1);
    expect(events[0][0].type).toBe('done');
    expect(events[0][0].session.id).toBe(s.id);
  });

  it('emits event when a session transitions working → error', () => {
    const store = createSessionStore();
    const router = createNotificationRouter(store);
    const events: Parameters<Parameters<typeof router.subscribe>[0]>[] = [];
    router.subscribe((evt) => events.push([evt]));

    const s = store.create({ agent: 'claude', label: 'test', cwd: '/tmp' });
    store.update(s.id, { status: 'working' });
    store.update(s.id, { status: 'error' });

    expect(events).toHaveLength(1);
    expect(events[0][0].type).toBe('error');
  });

  it('does not emit on idle → done', () => {
    const store = createSessionStore();
    const router = createNotificationRouter(store);
    let count = 0;
    router.subscribe(() => count++);

    const s = store.create({ agent: 'claude', label: 'test', cwd: '/tmp' });
    store.update(s.id, { status: 'done' });

    expect(count).toBe(0);
  });

  it('does not emit on working → idle', () => {
    const store = createSessionStore();
    const router = createNotificationRouter(store);
    let count = 0;
    router.subscribe(() => count++);

    const s = store.create({ agent: 'claude', label: 'test', cwd: '/tmp' });
    store.update(s.id, { status: 'working' });
    store.update(s.id, { status: 'idle' });

    expect(count).toBe(0);
  });

  it('tracks lastEvent', () => {
    const store = createSessionStore();
    const router = createNotificationRouter(store);
    expect(router.lastEvent()).toBeNull();

    const s = store.create({ agent: 'claude', label: 'test', cwd: '/tmp' });
    store.update(s.id, { status: 'working' });
    store.update(s.id, { status: 'done' });

    expect(router.lastEvent()?.type).toBe('done');
  });

  it('unsubscribe stops further events', () => {
    const store = createSessionStore();
    const router = createNotificationRouter(store);
    let count = 0;
    const unsub = router.subscribe(() => count++);

    const s = store.create({ agent: 'claude', label: 'test', cwd: '/tmp' });
    store.update(s.id, { status: 'working' });
    store.update(s.id, { status: 'done' });
    expect(count).toBe(1);

    unsub();
    store.update(s.id, { status: 'working' });
    store.update(s.id, { status: 'error' });
    expect(count).toBe(1);
  });

  it('emits per-session, not globally deduplicated', () => {
    const store = createSessionStore();
    const router = createNotificationRouter(store);
    let count = 0;
    router.subscribe(() => count++);

    const a = store.create({ agent: 'claude', label: 'A', cwd: '/tmp' });
    const b = store.create({ agent: 'claude', label: 'B', cwd: '/tmp' });
    store.update(a.id, { status: 'working' });
    store.update(b.id, { status: 'working' });
    store.update(a.id, { status: 'done' });
    store.update(b.id, { status: 'done' });

    expect(count).toBe(2);
  });
});
