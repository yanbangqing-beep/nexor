import { describe, expect, it } from 'vitest';
import {
  buildClaudeArgs,
  createClaudeAdapter,
  normalizeClaudeEvent,
} from '../src/adapters/claude.js';
import type { AgentEvent, ExecOpts } from '../src/types.js';
import { createFakeChild } from './helpers/fake-child.js';
import { createTimedFakeChild } from './helpers/timed-fake-child.js';

const baseOpts: ExecOpts = {
  prompt: 'hi',
  cwd: '/tmp',
  signal: new AbortController().signal,
};

describe('buildClaudeArgs', () => {
  it('always includes prompt + stream-json + skip-permissions flags', () => {
    const args = buildClaudeArgs(baseOpts);
    expect(args).toContain('-p');
    expect(args).toContain('hi');
    expect(args).toContain('--output-format');
    expect(args).toContain('stream-json');
    expect(args).toContain('--dangerously-skip-permissions');
    expect(args).not.toContain('--resume');
  });

  it('appends --resume when agentSessionId provided', () => {
    const args = buildClaudeArgs({ ...baseOpts, agentSessionId: 'sess-123' });
    expect(args).toContain('--resume');
    const idx = args.indexOf('--resume');
    expect(args[idx + 1]).toBe('sess-123');
  });
});

describe('normalizeClaudeEvent', () => {
  it('extracts session_id on first sighting', () => {
    const evts = normalizeClaudeEvent({ type: 'system', session_id: 'abc' }, false);
    expect(evts).toContainEqual({ type: 'session', id: 'abc' });
  });

  it('does not re-emit session if already emitted', () => {
    const evts = normalizeClaudeEvent({ type: 'system', session_id: 'abc' }, true);
    expect(evts.find((e) => e.type === 'session')).toBeUndefined();
  });

  it('extracts text from assistant message content', () => {
    const evts = normalizeClaudeEvent(
      {
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'hello there' }] },
      },
      false,
    );
    expect(evts).toContainEqual({ type: 'output', text: 'hello there' });
  });

  it('extracts tool_use as bracketed indicator', () => {
    const evts = normalizeClaudeEvent(
      {
        type: 'assistant',
        message: { content: [{ type: 'tool_use', name: 'read_file' }] },
      },
      false,
    );
    expect(evts).toContainEqual({ type: 'output', text: '[tool: read_file]' });
  });

  it('does not emit result-event text (assistant already streamed it)', () => {
    const evts = normalizeClaudeEvent({ type: 'result', result: 'final answer' }, true);
    expect(evts.find((e) => e.type === 'output')).toBeUndefined();
  });

  it('passes raw lines through as output', () => {
    const evts = normalizeClaudeEvent({ __raw: 'plain text' }, false);
    expect(evts).toEqual([{ type: 'output', text: 'plain text' }]);
  });

  it('ignores user-echo events to prevent duplication', () => {
    const evts = normalizeClaudeEvent({ type: 'user', message: { content: 'hi' } }, true);
    expect(evts).toEqual([]);
  });
});

describe('claude adapter exec()', () => {
  it('yields session, output, then done events end-to-end against a fake child', async () => {
    const stdout = `${[
      JSON.stringify({ type: 'system', subtype: 'init', session_id: 'sess-xyz' }),
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'hi back' }] },
      }),
      JSON.stringify({ type: 'result', result: 'done', session_id: 'sess-xyz' }),
    ].join('\n')}\n`;

    const adapter = createClaudeAdapter({ spawn: () => createFakeChild({ stdout, exitCode: 0 }) });

    const events: AgentEvent[] = [];
    for await (const evt of adapter.exec(baseOpts)) events.push(evt);

    expect(events[0]).toEqual({ type: 'session', id: 'sess-xyz' });
    expect(events.some((e) => e.type === 'output' && e.text === 'hi back')).toBe(true);
    expect(events[events.length - 1]).toEqual({ type: 'done', exitCode: 0 });
  });

  it('does not duplicate the answer when result echoes the final assistant text', async () => {
    const answer = 'Hi! What would you like to work on?';
    const stdout = `${[
      JSON.stringify({ type: 'system', subtype: 'init', session_id: 's1' }),
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: answer }] },
      }),
      JSON.stringify({ type: 'result', result: answer, session_id: 's1' }),
    ].join('\n')}\n`;

    const adapter = createClaudeAdapter({ spawn: () => createFakeChild({ stdout, exitCode: 0 }) });
    const events: AgentEvent[] = [];
    for await (const evt of adapter.exec(baseOpts)) events.push(evt);

    const outputs = events.filter((e) => e.type === 'output');
    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toEqual({ type: 'output', text: answer });
  });

  it('emits session only once even if it appears in multiple events', async () => {
    const stdout = `${[
      JSON.stringify({ session_id: 'a', type: 'system' }),
      JSON.stringify({ session_id: 'a', type: 'result', result: 'x' }),
    ].join('\n')}\n`;

    const adapter = createClaudeAdapter({ spawn: () => createFakeChild({ stdout, exitCode: 0 }) });
    const events: AgentEvent[] = [];
    for await (const evt of adapter.exec(baseOpts)) events.push(evt);

    expect(events.filter((e) => e.type === 'session')).toHaveLength(1);
  });

  it('still yields done with non-zero exit when child fails', async () => {
    const adapter = createClaudeAdapter({
      spawn: () => createFakeChild({ stdout: '', exitCode: 1 }),
    });
    const events: AgentEvent[] = [];
    for await (const evt of adapter.exec(baseOpts)) events.push(evt);

    expect(events[events.length - 1]).toEqual({ type: 'done', exitCode: 1 });
  });

  it('yields a stderr event before done when child writes to stderr', async () => {
    const adapter = createClaudeAdapter({
      spawn: () => createFakeChild({ stdout: '', stderr: 'claude: not found\n', exitCode: 127 }),
    });
    const events: AgentEvent[] = [];
    for await (const evt of adapter.exec(baseOpts)) events.push(evt);

    const stderrIdx = events.findIndex((e) => e.type === 'stderr');
    const doneIdx = events.findIndex((e) => e.type === 'done');
    expect(stderrIdx).toBeGreaterThanOrEqual(0);
    expect(stderrIdx).toBeLessThan(doneIdx);
    expect(events[stderrIdx]).toEqual({ type: 'stderr', text: 'claude: not found' });
  });

  it('omits stderr event when child stderr is empty', async () => {
    const adapter = createClaudeAdapter({
      spawn: () => createFakeChild({ stdout: '', exitCode: 0 }),
    });
    const events: AgentEvent[] = [];
    for await (const evt of adapter.exec(baseOpts)) events.push(evt);
    expect(events.some((e) => e.type === 'stderr')).toBe(false);
  });

  it('yields one stderr event per line in real time, before stdout/done', async () => {
    // stderr writes two lines well before any stdout activity. The adapter
    // must surface them as separate, ordered events that arrive before the
    // stdout-derived output and the final done.
    const adapter = createClaudeAdapter({
      spawn: () =>
        createTimedFakeChild({
          stderrSchedule: [
            { at: 0, text: 'auth required\n' },
            { at: 20, text: 'try claude login\n' },
          ],
          stdoutSchedule: [
            {
              at: 60,
              text: `${JSON.stringify({
                type: 'assistant',
                message: { content: [{ type: 'text', text: 'hi' }] },
              })}\n`,
            },
          ],
          exitAt: 90,
          exitCode: 0,
        }),
    });

    const events: AgentEvent[] = [];
    for await (const evt of adapter.exec(baseOpts)) events.push(evt);

    const stderrEvents = events.filter((e) => e.type === 'stderr');
    expect(stderrEvents).toEqual([
      { type: 'stderr', text: 'auth required' },
      { type: 'stderr', text: 'try claude login' },
    ]);

    const firstStderrIdx = events.findIndex((e) => e.type === 'stderr');
    const outputIdx = events.findIndex((e) => e.type === 'output');
    const doneIdx = events.findIndex((e) => e.type === 'done');
    expect(firstStderrIdx).toBeLessThan(outputIdx);
    expect(outputIdx).toBeLessThan(doneIdx);
  });
});
