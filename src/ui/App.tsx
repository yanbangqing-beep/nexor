import { Box, useApp, useInput } from 'ink';
import { useCallback, useEffect, useState } from 'react';
import type { AdapterRegistry } from '../adapters/registry.js';
import type { Runner } from '../runner.js';
import type { OutputStore } from '../state/outputs.js';
import type { SessionStore } from '../state/store.js';
import type { Session } from '../types.js';
import { Detail } from './Detail.js';
import { type NewSessionInput, NewSessionModal } from './NewSessionModal.js';
import { Prompt } from './Prompt.js';
import { Sidebar } from './Sidebar.js';
import { StatusBar } from './StatusBar.js';
import { sortSessions } from './sort.js';

export interface AppProps {
  store: SessionStore;
  outputs: OutputStore;
  runner: Runner;
  registry: AdapterRegistry;
}

type Focus = 'sidebar' | 'prompt';

export function App({ store, outputs, runner, registry }: AppProps) {
  const { exit } = useApp();
  const [sessions, setSessions] = useState<Session[]>(store.list());
  const [, setOutputTick] = useState(0);
  const [focus, setFocus] = useState<Focus>('sidebar');
  const [selectedId, setSelectedId] = useState<string | null>(sessions[0]?.id ?? null);
  const [showModal, setShowModal] = useState(false);
  const [input, setInput] = useState('');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  useEffect(() => store.subscribe(() => setSessions(store.list())), [store]);
  useEffect(() => outputs.subscribe(() => setOutputTick((n) => n + 1)), [outputs]);

  const sorted = sortSessions(sessions);
  if (selectedId && !sorted.some((s) => s.id === selectedId)) {
    // selected was deleted; pick first
    setTimeout(() => setSelectedId(sorted[0]?.id ?? null), 0);
  }
  const selectedIdx = sorted.findIndex((s) => s.id === selectedId);
  const selected = selectedIdx >= 0 ? sorted[selectedIdx] : sorted[0];

  useInput((char, key) => {
    if (showModal) return;
    if (key.ctrl && char === 'c') {
      runner.cancelAll();
      exit();
      return;
    }
    if (key.tab) {
      setFocus((f) => (f === 'sidebar' ? 'prompt' : 'sidebar'));
      return;
    }
    if (focus === 'sidebar') {
      if (char === 'n') {
        setShowModal(true);
      } else if (char === 'j' || key.downArrow) {
        const next = Math.min(sorted.length - 1, Math.max(0, selectedIdx) + 1);
        setSelectedId(sorted[next]?.id ?? null);
      } else if (char === 'k' || key.upArrow) {
        const next = Math.max(0, selectedIdx - 1);
        setSelectedId(sorted[next]?.id ?? null);
      }
    }
  });

  const onSubmitPrompt = useCallback(
    (value: string) => {
      const v = value.trim();
      if (!v || !selected) return;
      setInput('');
      setErrorBanner(null);
      runner.run(selected.id, v).catch((err: Error) => {
        setErrorBanner(err.message);
      });
    },
    [selected, runner],
  );

  const onModalSubmit = useCallback(
    (req: NewSessionInput) => {
      const s = store.create(req);
      setSelectedId(s.id);
      setShowModal(false);
    },
    [store],
  );

  if (showModal) {
    return (
      <Box padding={1}>
        <NewSessionModal
          defaultCwd={process.cwd()}
          registry={registry}
          onSubmit={onModalSubmit}
          onCancel={() => setShowModal(false)}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      <Box flexGrow={1}>
        <Sidebar
          sessions={sorted}
          selectedId={selected?.id ?? null}
          focused={focus === 'sidebar'}
        />
        <Detail session={selected} output={selected ? outputs.get(selected.id) : ''} />
      </Box>
      <StatusBar
        sessions={sessions}
        muted={false}
        hint={errorBanner ? `! ${errorBanner}` : undefined}
      />
      <Prompt
        value={input}
        onChange={setInput}
        onSubmit={onSubmitPrompt}
        focused={focus === 'prompt'}
        target={selected ? `${selected.agent}/${selected.label}` : '(no session)'}
      />
    </Box>
  );
}
