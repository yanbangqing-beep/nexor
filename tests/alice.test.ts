import { describe, expect, it } from 'vitest';
import { buildAliceArgs, createAliceAdapter, normalizeAliceEvent } from '../src/adapters/alice.js';
import type { AgentEvent, ExecOpts } from '../src/types.js';
import { createFakeChild } from './helpers/fake-child.js';

const baseOpts: ExecOpts = {
  prompt: 'hi',
  cwd: '/tmp/project',
  signal: new AbortController().signal,
};

describe('buildAliceArgs', () => {
  it('builds headless JSON exec args with cwd and prompt', () => {
    expect(buildAliceArgs(baseOpts)).toEqual(['exec', '--json', '--cwd', '/tmp/project', 'hi']);
  });

  it('adds --session when agentSessionId is present', () => {
    expect(buildAliceArgs({ ...baseOpts, agentSessionId: 'sess-1' })).toEqual([
      'exec',
      '--json',
      '--cwd',
      '/tmp/project',
      '--session',
      'sess-1',
      'hi',
    ]);
  });
});

describe('normalizeAliceEvent', () => {
  it('extracts session_id on first sighting', () => {
    expect(normalizeAliceEvent({ type: 'session', session_id: 'abc' }, false)).toContainEqual({
      type: 'session',
      id: 'abc',
    });
  });

  it('does not re-emit session if already emitted', () => {
    const evts = normalizeAliceEvent({ type: 'session', session_id: 'abc' }, true);
    expect(evts.find((e) => e.type === 'session')).toBeUndefined();
  });

  it('extracts agent_message text', () => {
    expect(normalizeAliceEvent({ type: 'agent_message', text: 'hello' }, true)).toContainEqual({
      type: 'output',
      text: 'hello',
    });
  });

  it('renders tool calls and errors as output markers', () => {
    expect(normalizeAliceEvent({ type: 'tool_call', name: 'read' }, true)).toContainEqual({
      type: 'output',
      text: '[tool: read]',
    });
    expect(normalizeAliceEvent({ type: 'error', message: 'bad' }, true)).toContainEqual({
      type: 'output',
      text: '[error] bad',
    });
  });
});

describe('alice adapter exec()', () => {
  it('yields session, output, stderr, and done events', async () => {
    const stdout = `${[
      JSON.stringify({ type: 'session', session_id: 'sess-1' }),
      JSON.stringify({ type: 'agent_message', text: 'hi back' }),
    ].join('\n')}\n`;
    const adapter = createAliceAdapter({
      spawn: (cmd, args, opts) => {
        expect(cmd).toBe('alice');
        expect(args).toEqual(['exec', '--json', '--cwd', '/tmp/project', 'hi']);
        expect(opts.cwd).toBe('/tmp/project');
        return createFakeChild({ stdout, stderr: 'warning\n', exitCode: 0 });
      },
    });

    const events: AgentEvent[] = [];
    for await (const evt of adapter.exec(baseOpts)) events.push(evt);

    expect(events[0]).toEqual({ type: 'session', id: 'sess-1' });
    expect(events).toContainEqual({ type: 'output', text: 'hi back' });
    expect(events).toContainEqual({ type: 'stderr', text: 'warning' });
    expect(events[events.length - 1]).toEqual({ type: 'done', exitCode: 0 });
  });

  it('turns a missing alice binary into a failed done event instead of throwing', async () => {
    const adapter = createAliceAdapter({ binary: '__missing_alice_for_nexor_test__' });

    const events: AgentEvent[] = [];
    for await (const evt of adapter.exec(baseOpts)) events.push(evt);

    expect(events[events.length - 1]).toEqual({ type: 'done', exitCode: -2 });
  });
});
