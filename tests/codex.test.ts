import { describe, expect, it } from 'vitest';
import {
  buildCodexArgs,
  createCodexAdapter,
  isCodexStderrNoise,
  normalizeCodexEvent,
} from '../src/adapters/codex.js';
import type { AgentEvent, ExecOpts } from '../src/types.js';
import { createFakeChild } from './helpers/fake-child.js';

const baseOpts: ExecOpts = {
  prompt: 'hi',
  cwd: '/tmp',
  signal: new AbortController().signal,
};

describe('buildCodexArgs', () => {
  it('uses exec subcommand with json + bypass flags', () => {
    const args = buildCodexArgs(baseOpts);
    expect(args[0]).toBe('exec');
    expect(args).toContain('--json');
    expect(args).toContain('--dangerously-bypass-approvals-and-sandbox');
    expect(args).toContain('--skip-git-repo-check');
    expect(args).toContain('hi');
    expect(args).not.toContain('resume');
  });

  it('uses exec resume <id> subcommand when agentSessionId provided', () => {
    const args = buildCodexArgs({ ...baseOpts, agentSessionId: 'sess-123' });
    expect(args[0]).toBe('exec');
    expect(args[1]).toBe('resume');
    expect(args[2]).toBe('sess-123');
  });
});

describe('normalizeCodexEvent', () => {
  it('extracts thread_id from thread.started on first sighting', () => {
    const evts = normalizeCodexEvent({ type: 'thread.started', thread_id: 'abc' }, false);
    expect(evts).toContainEqual({ type: 'session', id: 'abc' });
  });

  it('falls back to legacy session_id when thread_id is absent', () => {
    const evts = normalizeCodexEvent({ type: 'init', session_id: 'abc' }, false);
    expect(evts).toContainEqual({ type: 'session', id: 'abc' });
  });

  it('does not re-emit session if already emitted', () => {
    const evts = normalizeCodexEvent({ type: 'thread.started', thread_id: 'abc' }, true);
    expect(evts.find((e) => e.type === 'session')).toBeUndefined();
  });

  it('extracts agent_message text from item.completed', () => {
    const evts = normalizeCodexEvent(
      {
        type: 'item.completed',
        item: { id: 'item_0', type: 'agent_message', text: 'hello there' },
      },
      true,
    );
    expect(evts).toContainEqual({ type: 'output', text: 'hello there' });
  });

  it('extracts command_execution as exec line with exit code', () => {
    const evts = normalizeCodexEvent(
      {
        type: 'item.completed',
        item: { type: 'command_execution', command: 'ls /tmp', exit_code: 0, status: 'completed' },
      },
      true,
    );
    expect(evts).toContainEqual({ type: 'output', text: '[exec exit 0] ls /tmp' });
  });

  it('passes raw lines through as output', () => {
    const evts = normalizeCodexEvent({ __raw: 'plain text' }, false);
    expect(evts).toEqual([{ type: 'output', text: 'plain text' }]);
  });

  it('filters codex trailing "Shell cwd was reset" tail line', () => {
    const evts = normalizeCodexEvent({ __raw: 'Shell cwd was reset to /Volumes/x' }, true);
    expect(evts).toEqual([]);
  });

  it('ignores turn-boundary and item-started events', () => {
    expect(normalizeCodexEvent({ type: 'turn.started' }, true)).toEqual([]);
    expect(normalizeCodexEvent({ type: 'turn.completed', usage: {} }, true)).toEqual([]);
    expect(
      normalizeCodexEvent(
        { type: 'item.started', item: { type: 'command_execution', command: 'ls' } },
        true,
      ),
    ).toEqual([]);
  });
});

describe('isCodexStderrNoise', () => {
  it('matches the stdin-notice line', () => {
    expect(isCodexStderrNoise('Reading additional input from stdin...')).toBe(true);
  });

  it('matches the models-manager timeout warning', () => {
    expect(
      isCodexStderrNoise(
        '2026-05-08T07:22:28.963704Z ERROR codex_models_manager::manager: failed to refresh available models: timeout waiting for child process to exit',
      ),
    ).toBe(true);
  });

  it('does not match a genuine error line', () => {
    expect(isCodexStderrNoise('codex: command failed: ENOENT')).toBe(false);
    expect(isCodexStderrNoise('panic: out of memory')).toBe(false);
  });
});

describe('codex adapter exec()', () => {
  it('yields session, output, then done events end-to-end', async () => {
    const stdout = `${[
      JSON.stringify({ type: 'thread.started', thread_id: 'sess-xyz' }),
      JSON.stringify({ type: 'turn.started' }),
      JSON.stringify({
        type: 'item.completed',
        item: { id: 'item_0', type: 'agent_message', text: 'hi back' },
      }),
      JSON.stringify({ type: 'turn.completed', usage: {} }),
      'Shell cwd was reset to /tmp',
    ].join('\n')}\n`;

    const adapter = createCodexAdapter({ spawn: () => createFakeChild({ stdout, exitCode: 0 }) });

    const events: AgentEvent[] = [];
    for await (const evt of adapter.exec(baseOpts)) events.push(evt);

    expect(events[0]).toEqual({ type: 'session', id: 'sess-xyz' });
    const outputs = events.filter((e) => e.type === 'output');
    expect(outputs).toEqual([{ type: 'output', text: 'hi back' }]);
    expect(events[events.length - 1]).toEqual({ type: 'done', exitCode: 0 });
  });

  it('drops codex stderr noise (stdin notice + models-manager timeout) from transcript', async () => {
    const stdout = `${JSON.stringify({
      type: 'item.completed',
      item: { id: 'item_0', type: 'agent_message', text: 'ok' },
    })}\n`;
    const stderr = [
      'Reading additional input from stdin...',
      '2026-05-08T07:22:28.963704Z ERROR codex_models_manager::manager: failed to refresh available models: timeout waiting for child process to exit',
      'genuine codex error: bad config',
    ].join('\n');

    const adapter = createCodexAdapter({
      spawn: () => createFakeChild({ stdout, stderr, exitCode: 0 }),
    });
    const events: AgentEvent[] = [];
    for await (const evt of adapter.exec(baseOpts)) events.push(evt);

    const stderrEvents = events.filter((e) => e.type === 'stderr');
    expect(stderrEvents).toEqual([{ type: 'stderr', text: 'genuine codex error: bad config' }]);
  });

  it('emits session only once even if it appears in multiple events', async () => {
    const stdout = `${[
      JSON.stringify({ type: 'thread.started', thread_id: 'a' }),
      // simulate a second event also carrying thread_id (defensive)
      JSON.stringify({
        type: 'item.completed',
        thread_id: 'a',
        item: { type: 'agent_message', text: 'x' },
      }),
    ].join('\n')}\n`;

    const adapter = createCodexAdapter({ spawn: () => createFakeChild({ stdout, exitCode: 0 }) });
    const events: AgentEvent[] = [];
    for await (const evt of adapter.exec(baseOpts)) events.push(evt);

    expect(events.filter((e) => e.type === 'session')).toHaveLength(1);
  });

  it('still yields done with non-zero exit when child fails', async () => {
    const adapter = createCodexAdapter({
      spawn: () => createFakeChild({ stdout: '', exitCode: 1 }),
    });
    const events: AgentEvent[] = [];
    for await (const evt of adapter.exec(baseOpts)) events.push(evt);

    expect(events[events.length - 1]).toEqual({ type: 'done', exitCode: 1 });
  });

  it('yields a stderr event before done when child writes to stderr', async () => {
    const adapter = createCodexAdapter({
      spawn: () => createFakeChild({ stdout: '', stderr: 'codex: command failed\n', exitCode: 1 }),
    });
    const events: AgentEvent[] = [];
    for await (const evt of adapter.exec(baseOpts)) events.push(evt);

    const stderrIdx = events.findIndex((e) => e.type === 'stderr');
    const doneIdx = events.findIndex((e) => e.type === 'done');
    expect(stderrIdx).toBeGreaterThanOrEqual(0);
    expect(stderrIdx).toBeLessThan(doneIdx);
    expect(events[stderrIdx]).toEqual({ type: 'stderr', text: 'codex: command failed' });
  });
});
