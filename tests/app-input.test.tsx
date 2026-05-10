import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';
import { createNotificationRouter } from '../src/notify/router.js';
import type { Runner } from '../src/runner.js';
import { createOutputStore } from '../src/state/outputs.js';
import { createPromptHistoryStore } from '../src/state/prompt-history.js';
import { createSessionStore } from '../src/state/store.js';
import type { Session } from '../src/types.js';
import { App } from '../src/ui/App.js';
import { KEY, pressKey } from './helpers/ink-input.js';

function stripAnsi(s: string): string {
  const esc = String.fromCharCode(27);
  return s.replace(new RegExp(`${esc}\\[[0-9;?]*[A-Za-z~]`, 'g'), '');
}

function idleSession(id = 's1', label = 'demo'): Session {
  return {
    id,
    agent: 'alice',
    label,
    cwd: '/tmp',
    status: 'idle',
    createdAt: 1,
    lastActivity: 1,
    messageCount: 0,
  };
}

function createNoopRunner(): Runner {
  return {
    run: vi.fn(async () => {}),
    isRunning: vi.fn(() => false),
    cancel: vi.fn(),
    cancelAll: vi.fn(),
    reset: vi.fn(),
    delete: vi.fn(() => true),
  };
}

describe('App prompt input', () => {
  it('renders the first typed character in the prompt box', async () => {
    const store = createSessionStore([idleSession()]);
    const outputs = createOutputStore();
    const { stdin, lastFrame } = render(
      <App
        store={store}
        outputs={outputs}
        runner={createNoopRunner()}
        registry={{ alice: { name: 'alice', exec: async function* () {} } }}
        router={createNotificationRouter(store)}
        history={createPromptHistoryStore()}
        config={{ desktop: false, bell: false }}
      />,
    );

    await pressKey(stdin, 'h');

    expect(stripAnsi(lastFrame() ?? '')).toContain('> h');
  });

  it('keeps the first printable character typed from command mode', async () => {
    const store = createSessionStore([idleSession()]);
    const outputs = createOutputStore();
    const { stdin, lastFrame } = render(
      <App
        store={store}
        outputs={outputs}
        runner={createNoopRunner()}
        registry={{ alice: { name: 'alice', exec: async function* () {} } }}
        router={createNotificationRouter(store)}
        history={createPromptHistoryStore()}
        config={{ desktop: false, bell: false }}
      />,
    );

    await pressKey(stdin, KEY.escape);
    await pressKey(stdin, 'h');

    const frame = stripAnsi(lastFrame() ?? '');
    expect(frame).toContain('INSERT');
    expect(frame).toContain('> h');
  });

  it('uses Alt+Up and Alt+Down for session switching while plain arrows stay for history', async () => {
    const store = createSessionStore([idleSession('s1', 'first'), idleSession('s2', 'second')]);
    const outputs = createOutputStore();
    const { stdin, lastFrame } = render(
      <App
        store={store}
        outputs={outputs}
        runner={createNoopRunner()}
        registry={{ alice: { name: 'alice', exec: async function* () {} } }}
        router={createNotificationRouter(store)}
        history={createPromptHistoryStore()}
        config={{ desktop: false, bell: false }}
      />,
    );

    await pressKey(stdin, KEY.altDown);
    expect(stripAnsi(lastFrame() ?? '')).toContain('→ alice/second');

    await pressKey(stdin, KEY.altUp);
    expect(stripAnsi(lastFrame() ?? '')).toContain('→ alice/first');
  });

  it('keeps CJK char when ink parses it as ESC-prefixed sequence', async () => {
    // macOS Pinyin / Squirrel: composed CJK chars arrive as ESC + utf8, which
    // ink's keypress parser surfaces with key.escape=true alongside the char.
    // Without the fix, App would switch to command mode and drop the char.
    const store = createSessionStore([idleSession()]);
    const outputs = createOutputStore();
    const { stdin, lastFrame } = render(
      <App
        store={store}
        outputs={outputs}
        runner={createNoopRunner()}
        registry={{ alice: { name: 'alice', exec: async function* () {} } }}
        router={createNotificationRouter(store)}
        history={createPromptHistoryStore()}
        config={{ desktop: false, bell: false }}
      />,
    );

    await pressKey(stdin, `${KEY.escape}你`);
    await pressKey(stdin, `${KEY.escape}好`);

    const frame = stripAnsi(lastFrame() ?? '');
    expect(frame).toContain('INSERT');
    expect(frame).toContain('你好');
  });

  it('clears prompt input with Ctrl+C in insert mode', async () => {
    const store = createSessionStore([idleSession()]);
    const outputs = createOutputStore();
    const { stdin, lastFrame } = render(
      <App
        store={store}
        outputs={outputs}
        runner={createNoopRunner()}
        registry={{ alice: { name: 'alice', exec: async function* () {} } }}
        router={createNotificationRouter(store)}
        history={createPromptHistoryStore()}
        config={{ desktop: false, bell: false }}
      />,
    );

    await pressKey(stdin, 'h');
    expect(stripAnsi(lastFrame() ?? '')).toContain('> h');

    await pressKey(stdin, KEY.ctrlC);
    expect(stripAnsi(lastFrame() ?? '')).not.toContain('> h');
  });

  it('collapses a large paste visually but submits the complete prompt', async () => {
    const store = createSessionStore([idleSession()]);
    const outputs = createOutputStore();
    const runner = createNoopRunner();
    const pasted = 'x'.repeat(700);
    const { stdin, lastFrame } = render(
      <App
        store={store}
        outputs={outputs}
        runner={runner}
        registry={{ alice: { name: 'alice', exec: async function* () {} } }}
        router={createNotificationRouter(store)}
        history={createPromptHistoryStore()}
        config={{ desktop: false, bell: false }}
      />,
    );

    await new Promise((r) => setTimeout(r, 30));
    for (const char of pasted) stdin.write(char);
    await new Promise((r) => setTimeout(r, 30));

    const frame = stripAnsi(lastFrame() ?? '');
    expect(frame).toMatch(/\d+ chars/);
    expect(frame).not.toContain(`> ${'x'.repeat(120)}`);

    await pressKey(stdin, KEY.enter);
    expect(runner.run).toHaveBeenCalledTimes(1);
    const submitted = vi.mocked(runner.run).mock.calls[0]?.[1] ?? '';
    expect(submitted.length).toBeGreaterThan(280);
    expect(frame).toContain(`${submitted.length} chars`);
  });

  it('shows /h help inside the main layout and closes back to detail', async () => {
    const store = createSessionStore([idleSession()]);
    const outputs = createOutputStore();
    const { stdin, lastFrame } = render(
      <App
        store={store}
        outputs={outputs}
        runner={createNoopRunner()}
        registry={{ alice: { name: 'alice', exec: async function* () {} } }}
        router={createNotificationRouter(store)}
        history={createPromptHistoryStore()}
        config={{ desktop: false, bell: false }}
      />,
    );

    await pressKey(stdin, '/h');
    await pressKey(stdin, KEY.enter);

    let frame = stripAnsi(lastFrame() ?? '');
    expect(frame).toContain('sessions (1)');
    expect(frame).toContain('help');
    expect(frame).toContain('slash commands');
    expect(frame).toContain('/clear');
    expect(frame).toContain('modal controls');
    expect(frame).toContain('> ');

    await pressKey(stdin, 'q');

    frame = stripAnsi(lastFrame() ?? '');
    expect(frame).toContain('(no output yet');
    expect(frame).not.toContain('slash commands');
  });
});
