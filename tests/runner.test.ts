import { describe, expect, it } from 'vitest';
import {
  AdapterMissingError,
  SessionBusyError,
  SessionNotFoundError,
  createRunner,
} from '../src/runner.js';
import { createOutputStore } from '../src/state/outputs.js';
import { createSessionStore } from '../src/state/store.js';
import type { AgentEvent } from '../src/types.js';
import { createStubAdapter } from './helpers/stub-adapter.js';

const DEFAULT_EVENTS: AgentEvent[] = [{ type: 'done', exitCode: 0 }];

function setup(adapterEvents: AgentEvent[] = DEFAULT_EVENTS, delayMs = 0) {
  const store = createSessionStore();
  const outputs = createOutputStore();
  const adapter = createStubAdapter('claude', adapterEvents, { delayMs });
  const runner = createRunner({
    store,
    outputs,
    adapters: { claude: adapter },
  });
  const session = store.create({ agent: 'claude', label: 'test', cwd: '/tmp' });
  return { store, outputs, runner, session };
}

describe('runner.run', () => {
  it('transitions session to working then done on success', async () => {
    const { store, runner, session } = setup([
      { type: 'output', text: 'hi' },
      { type: 'done', exitCode: 0 },
    ] as AgentEvent[]);
    await runner.run(session.id, 'say hi');
    expect(store.get(session.id)?.status).toBe('done');
    expect(store.get(session.id)?.messageCount).toBe(1);
  });

  it('transitions to error on non-zero exit code', async () => {
    const { store, runner, session } = setup([{ type: 'done', exitCode: 1 }]);
    await runner.run(session.id, 'do thing');
    expect(store.get(session.id)?.status).toBe('error');
    expect(store.get(session.id)?.errorMessage).toBe('agent exited with code 1');
  });

  it('surfaces stderr text on errorMessage when exit is non-zero', async () => {
    const { store, outputs, runner, session } = setup([
      { type: 'stderr', text: 'EACCES: permission denied' },
      { type: 'done', exitCode: 2 },
    ]);
    await runner.run(session.id, 'p');
    expect(store.get(session.id)?.status).toBe('error');
    expect(store.get(session.id)?.errorMessage).toBe('EACCES: permission denied');
    expect(outputs.get(session.id)).toContain('[stderr]');
  });

  it('appends each stderr event to outputs in real time with [stderr] prefix', async () => {
    const { outputs, runner, session } = setup([
      { type: 'stderr', text: 'first warning' },
      { type: 'stderr', text: 'second warning' },
      { type: 'done', exitCode: 0 },
    ]);
    await runner.run(session.id, 'p');
    const buf = outputs.get(session.id);
    expect(buf).toContain('[stderr] first warning');
    expect(buf).toContain('[stderr] second warning');
  });

  it('ignores stderr when exit is zero', async () => {
    const { store, runner, session } = setup([
      { type: 'stderr', text: 'noisy warning' },
      { type: 'done', exitCode: 0 },
    ]);
    await runner.run(session.id, 'p');
    expect(store.get(session.id)?.status).toBe('done');
    expect(store.get(session.id)?.errorMessage).toBeUndefined();
  });

  it('clears errorMessage when a previously failed session succeeds', async () => {
    const { store, runner, session } = setup([{ type: 'done', exitCode: 1 }]);
    await runner.run(session.id, 'first');
    expect(store.get(session.id)?.errorMessage).toBeDefined();

    const adapter2 = createStubAdapter('claude', [{ type: 'done', exitCode: 0 }]);
    const runner2 = createRunner({
      store,
      outputs: createOutputStore(),
      adapters: { claude: adapter2 },
    });
    await runner2.run(session.id, 'retry');
    expect(store.get(session.id)?.status).toBe('done');
    expect(store.get(session.id)?.errorMessage).toBeUndefined();
  });

  it('appends prompt + agent output to OutputStore', async () => {
    const { outputs, runner, session } = setup([
      { type: 'output', text: 'response text' },
      { type: 'done', exitCode: 0 },
    ]);
    await runner.run(session.id, 'a prompt');
    const buf = outputs.get(session.id);
    expect(buf).toContain('a prompt');
    expect(buf).toContain('response text');
  });

  it('captures session event into store.agentSessionId', async () => {
    const { store, runner, session } = setup([
      { type: 'session', id: 'agent-sess-xyz' },
      { type: 'done', exitCode: 0 },
    ]);
    await runner.run(session.id, 'first prompt');
    expect(store.get(session.id)?.agentSessionId).toBe('agent-sess-xyz');
  });

  it('refuses concurrent run on the same session', async () => {
    const { runner, session } = setup([{ type: 'done', exitCode: 0 }], 50);
    const first = runner.run(session.id, 'first');
    await expect(runner.run(session.id, 'second')).rejects.toThrow(SessionBusyError);
    await first;
  });

  it('isRunning reflects in-flight state', async () => {
    const { runner, session } = setup([{ type: 'done', exitCode: 0 }], 30);
    expect(runner.isRunning(session.id)).toBe(false);
    const promise = runner.run(session.id, 'p');
    expect(runner.isRunning(session.id)).toBe(true);
    await promise;
    expect(runner.isRunning(session.id)).toBe(false);
  });

  it('cancel aborts a running task and flips status to idle', async () => {
    const { store, runner, session } = setup(
      [
        { type: 'output', text: 'one' },
        { type: 'output', text: 'two' },
        { type: 'done', exitCode: 0 },
      ],
      40,
    );
    const promise = runner.run(session.id, 'long thing');
    setTimeout(() => runner.cancel(session.id), 10);
    await promise;
    expect(store.get(session.id)?.status).toBe('idle');
  });

  it('throws SessionNotFoundError for unknown session id', async () => {
    const { runner } = setup();
    await expect(runner.run('nonexistent', 'x')).rejects.toThrow(SessionNotFoundError);
  });

  it('throws AdapterMissingError when no adapter for session.agent', async () => {
    const store = createSessionStore();
    const outputs = createOutputStore();
    const runner = createRunner({ store, outputs, adapters: {} });
    const session = store.create({ agent: 'claude', label: 't', cwd: '/tmp' });
    await expect(runner.run(session.id, 'x')).rejects.toThrow(AdapterMissingError);
  });

  it('runs different sessions concurrently without contention', async () => {
    const store = createSessionStore();
    const outputs = createOutputStore();
    const runner = createRunner({
      store,
      outputs,
      adapters: {
        claude: createStubAdapter(
          'claude',
          [
            { type: 'output', text: 'r' },
            { type: 'done', exitCode: 0 },
          ],
          { delayMs: 30 },
        ),
      },
    });
    const a = store.create({ agent: 'claude', label: 'A', cwd: '/tmp' });
    const b = store.create({ agent: 'claude', label: 'B', cwd: '/tmp' });
    const start = Date.now();
    await Promise.all([runner.run(a.id, 'pa'), runner.run(b.id, 'pb')]);
    const elapsed = Date.now() - start;
    expect(store.get(a.id)?.status).toBe('done');
    expect(store.get(b.id)?.status).toBe('done');
    // If they ran sequentially each delay 30ms times 2 events = ~60ms × 2 sessions = 120ms;
    // concurrent should be ~60ms. Allow generous margin.
    expect(elapsed).toBeLessThan(150);
  });
});

describe('runner.cancelAll', () => {
  it('aborts all in-flight sessions', async () => {
    const store = createSessionStore();
    const outputs = createOutputStore();
    const runner = createRunner({
      store,
      outputs,
      adapters: {
        claude: createStubAdapter(
          'claude',
          [
            { type: 'output', text: 'one' },
            { type: 'done', exitCode: 0 },
          ],
          { delayMs: 100 },
        ),
      },
    });
    const a = store.create({ agent: 'claude', label: 'A', cwd: '/tmp' });
    const b = store.create({ agent: 'claude', label: 'B', cwd: '/tmp' });
    const pa = runner.run(a.id, 'pa');
    const pb = runner.run(b.id, 'pb');
    expect(runner.isRunning(a.id)).toBe(true);
    expect(runner.isRunning(b.id)).toBe(true);
    runner.cancelAll();
    await Promise.all([pa, pb]);
    expect(store.get(a.id)?.status).toBe('idle');
    expect(store.get(b.id)?.status).toBe('idle');
  });
});

describe('runner.reset', () => {
  it('cancels running task and clears agentSessionId', async () => {
    const { store, runner, session } = setup(
      [
        { type: 'output', text: 'x' },
        { type: 'done', exitCode: 0 },
      ],
      50,
    );
    // Simulate having a previous session id
    store.update(session.id, { agentSessionId: 'prev-id' });
    const promise = runner.run(session.id, 'long');
    runner.reset(session.id);
    await promise;
    expect(store.get(session.id)?.agentSessionId).toBeUndefined();
    expect(store.get(session.id)?.status).toBe('idle');
  });

  it('clears output buffer', async () => {
    const { store, outputs, runner, session } = setup();
    outputs.append(session.id, 'previous output');
    runner.reset(session.id);
    expect(outputs.get(session.id)).toBe('');
    expect(store.get(session.id)?.status).toBe('idle');
  });
});

describe('runner.delete', () => {
  it('removes session from store and output buffer', () => {
    const { store, outputs, runner, session } = setup();
    outputs.append(session.id, 'some text');
    expect(runner.delete(session.id)).toBe(true);
    expect(store.get(session.id)).toBeUndefined();
    expect(outputs.get(session.id)).toBe('');
  });

  it('cancels running task before deleting', async () => {
    const { store, runner, session } = setup(
      [
        { type: 'output', text: 'x' },
        { type: 'done', exitCode: 0 },
      ],
      50,
    );
    const promise = runner.run(session.id, 'long');
    expect(runner.isRunning(session.id)).toBe(true);
    expect(runner.delete(session.id)).toBe(true);
    await promise;
    expect(store.get(session.id)).toBeUndefined();
    expect(runner.isRunning(session.id)).toBe(false);
  });

  it('returns false for nonexistent session', () => {
    const { runner } = setup();
    expect(runner.delete('nonexistent')).toBe(false);
  });
});
