import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useCallback, useEffect, useState } from 'react';
import { createClaudeAdapter } from '../adapters/claude.js';
import type { SessionStore } from '../state/store.js';
import type { AgentEvent, Session } from '../types.js';

export interface AppProps {
  store: SessionStore;
}

const adapter = createClaudeAdapter();

export function App({ store }: AppProps) {
  const { exit } = useApp();
  const [sessions, setSessions] = useState<Session[]>(store.list());
  const [activeIdx, setActiveIdx] = useState(0);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState<string>('');
  const [running, setRunning] = useState(false);

  useEffect(() => store.subscribe(() => setSessions(store.list())), [store]);

  const active = sessions[activeIdx];

  useInput((char, key) => {
    if (key.ctrl && char === 'c') exit();
    if (char === '[') setActiveIdx((i) => Math.max(0, i - 1));
    if (char === ']') setActiveIdx((i) => Math.min(sessions.length - 1, i + 1));
  });

  const onSubmit = useCallback(
    async (value: string) => {
      if (!value.trim() || !active || running) return;
      setInput('');
      setOutput((o) => `${o}\n> ${value}\n`);
      setRunning(true);
      store.update(active.id, { status: 'working' });

      const ac = new AbortController();
      try {
        for await (const evt of adapter.exec({
          prompt: value,
          agentSessionId: active.agentSessionId,
          cwd: active.cwd,
          signal: ac.signal,
        })) {
          handleEvent(evt, active.id, store, setOutput);
        }
      } catch (err) {
        store.update(active.id, { status: 'error' });
        setOutput((o) => `${o}\n[error] ${(err as Error).message}\n`);
      } finally {
        setRunning(false);
      }
    },
    [active, running, store],
  );

  return (
    <Box flexDirection="column" height="100%">
      <Box borderStyle="round" borderColor="cyan" paddingX={1} flexDirection="column">
        <Text bold>nexor</Text>
        <Text dimColor>{sessions.length} session(s) · use [ ] to switch · ctrl+c quit</Text>
        {sessions.map((s, i) => (
          <Text key={s.id} color={i === activeIdx ? 'green' : 'gray'}>
            {i === activeIdx ? '▸ ' : '  '}[{s.agent}] {s.label} ({s.status})
            {s.agentSessionId ? ` · sess ${s.agentSessionId.slice(0, 8)}` : ''}
          </Text>
        ))}
      </Box>
      <Box flexGrow={1} flexDirection="column" paddingX={1}>
        {active ? (
          <Text>{output || '(no output yet — type a prompt and press Enter)'}</Text>
        ) : (
          <Text dimColor>(no sessions)</Text>
        )}
      </Box>
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="green">{'> '}</Text>
        <TextInput value={input} onChange={setInput} onSubmit={onSubmit} />
      </Box>
    </Box>
  );
}

function handleEvent(
  evt: AgentEvent,
  sessionId: string,
  store: SessionStore,
  setOutput: (fn: (o: string) => string) => void,
) {
  if (evt.type === 'output') {
    setOutput((o) => `${o}${evt.text}\n`);
  } else if (evt.type === 'session') {
    store.update(sessionId, { agentSessionId: evt.id });
  } else if (evt.type === 'done') {
    const existing = store.get(sessionId);
    store.update(sessionId, {
      status: evt.exitCode === 0 ? 'done' : 'error',
      messageCount: (existing?.messageCount ?? 0) + 1,
    });
    setOutput((o) => `${o}\n[exit ${evt.exitCode}]\n`);
  }
}
