import { describe, expect, it } from 'vitest';
import { buildCodexArgs, createCodexAdapter, normalizeCodexEvent } from '../src/adapters/codex.js';
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
  it('extracts session_id on first sighting', () => {
    const evts = normalizeCodexEvent({ type: 'init', session_id: 'abc' }, false);
    expect(evts).toContainEqual({ type: 'session', id: 'abc' });
  });

  it('does not re-emit session if already emitted', () => {
    const evts = normalizeCodexEvent({ type: 'init', session_id: 'abc' }, true);
    expect(evts.find((e) => e.type === 'session')).toBeUndefined();
  });

  it('extracts message content text', () => {
    const evts = normalizeCodexEvent({ type: 'message', content: 'hello there' }, false);
    expect(evts).toContainEqual({ type: 'output', text: 'hello there' });
  });

  it('extracts tool_call as bracketed indicator', () => {
    const evts = normalizeCodexEvent({ type: 'tool_call', name: 'read_file' }, false);
    expect(evts).toContainEqual({ type: 'output', text: '[tool: read_file]' });
  });

  it('extracts result output', () => {
    const evts = normalizeCodexEvent({ type: 'result', output: 'final answer' }, true);
    expect(evts).toContainEqual({ type: 'output', text: 'final answer' });
  });

  it('passes raw lines through as output', () => {
    const evts = normalizeCodexEvent({ __raw: 'plain text' }, false);
    expect(evts).toEqual([{ type: 'output', text: 'plain text' }]);
  });

  it('ignores unknown event shapes', () => {
    const evts = normalizeCodexEvent({ type: 'heartbeat' }, true);
    expect(evts).toEqual([]);
  });
});

describe('codex adapter exec()', () => {
  it('yields session, output, then done events end-to-end', async () => {
    const stdout = `${[
      JSON.stringify({ type: 'init', session_id: 'sess-xyz' }),
      JSON.stringify({ type: 'message', content: 'hi back' }),
      JSON.stringify({ type: 'result', output: 'done', session_id: 'sess-xyz' }),
    ].join('\n')}\n`;

    const adapter = createCodexAdapter({ spawn: () => createFakeChild({ stdout, exitCode: 0 }) });

    const events: AgentEvent[] = [];
    for await (const evt of adapter.exec(baseOpts)) events.push(evt);

    expect(events[0]).toEqual({ type: 'session', id: 'sess-xyz' });
    expect(events.some((e) => e.type === 'output' && e.text === 'hi back')).toBe(true);
    expect(events[events.length - 1]).toEqual({ type: 'done', exitCode: 0 });
  });

  it('emits session only once even if it appears in multiple events', async () => {
    const stdout = `${[
      JSON.stringify({ session_id: 'a', type: 'init' }),
      JSON.stringify({ session_id: 'a', type: 'result', output: 'x' }),
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
