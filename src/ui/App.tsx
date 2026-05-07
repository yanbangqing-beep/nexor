import { Box, Text, useApp, useInput } from 'ink';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdapterRegistry } from '../adapters/registry.js';
import { ringBell, sendDesktopNotification } from '../notify/desktop.js';
import type { NotificationEvent, NotificationRouter } from '../notify/router.js';
import type { Runner } from '../runner.js';
import type { OutputStore } from '../state/outputs.js';
import type { PromptHistoryStore } from '../state/prompt-history.js';
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
  router: NotificationRouter;
  history: PromptHistoryStore;
}

type Focus = 'sidebar' | 'prompt';
type Modal = 'new' | 'quit' | null;

export function App({ store, outputs, runner, registry, router, history }: AppProps) {
  const { exit } = useApp();
  const [sessions, setSessions] = useState<Session[]>(store.list());
  const [, setOutputTick] = useState(0);
  const [focus, setFocus] = useState<Focus>('sidebar');
  const [selectedId, setSelectedId] = useState<string | null>(sessions[0]?.id ?? null);
  const [modal, setModal] = useState<Modal>(null);
  const [input, setInput] = useState('');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimer = useRef<NodeJS.Timeout | null>(null);
  const [lastNotif, setLastNotif] = useState<NotificationEvent | null>(null);

  useEffect(() => store.subscribe(() => setSessions(store.list())), [store]);
  useEffect(() => outputs.subscribe(() => setOutputTick((n) => n + 1)), [outputs]);

  useEffect(() => {
    return router.subscribe((evt) => {
      setLastNotif(evt);
      setFlashId(evt.session.id);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlashId(null), 2000);
      if (!muted) {
        sendDesktopNotification(evt);
        ringBell();
      }
    });
  }, [router, muted]);

  const sorted = sortSessions(sessions);
  if (selectedId && !sorted.some((s) => s.id === selectedId)) {
    setTimeout(() => setSelectedId(sorted[0]?.id ?? null), 0);
  }
  const selectedIdx = sorted.findIndex((s) => s.id === selectedId);
  const selected = selectedIdx >= 0 ? sorted[selectedIdx] : sorted[0];

  const anyRunning = sessions.some((s) => s.status === 'working');

  useInput((char, key) => {
    if (modal === 'quit') {
      if (char === 'y') {
        runner.cancelAll();
        exit();
      } else if (char === 'n' || key.escape) {
        setModal(null);
      }
      return;
    }
    if (modal === 'new') return;

    if (key.ctrl && char === 'c') {
      runner.cancelAll();
      exit();
      return;
    }
    if (char === 'q') {
      if (anyRunning) {
        setModal('quit');
      } else {
        runner.cancelAll();
        exit();
      }
      return;
    }
    if (char === 'm') {
      setMuted((m) => !m);
      return;
    }
    if (key.tab) {
      setFocus((f) => (f === 'sidebar' ? 'prompt' : 'sidebar'));
      return;
    }

    if (focus === 'prompt') {
      if (key.shift && key.return) {
        setInput((v) => `${v}\n`);
        return;
      }
      if (key.return) {
        submitPrompt(input);
        return;
      }
      if (key.upArrow) {
        const h = history.up(selected?.id ?? '');
        if (h !== null) setInput(h);
        return;
      }
      if (key.downArrow) {
        const h = history.down(selected?.id ?? '');
        if (h !== null) setInput(h);
        return;
      }
    }

    if (focus === 'sidebar') {
      if (char === 'n') {
        setModal('new');
      } else if (char === 'c') {
        if (selected) runner.cancel(selected.id);
      } else if (char === 'r') {
        if (selected) runner.reset(selected.id);
      } else if (char === 'd') {
        if (selected) runner.delete(selected.id);
      } else if (char === 'j' || key.downArrow) {
        const next = Math.min(sorted.length - 1, Math.max(0, selectedIdx) + 1);
        setSelectedId(sorted[next]?.id ?? null);
      } else if (char === 'k' || key.upArrow) {
        const next = Math.max(0, selectedIdx - 1);
        setSelectedId(sorted[next]?.id ?? null);
      }
    }
  });

  const submitPrompt = useCallback(
    (value: string) => {
      const v = value.trim();
      if (!v || !selected) return;
      setInput('');
      history.push(selected.id, v);
      history.resetCursor(selected.id);
      setErrorBanner(null);
      runner.run(selected.id, v).catch((err: Error) => {
        setErrorBanner(err.message);
      });
    },
    [selected, runner, history],
  );

  const onModalSubmit = useCallback(
    (req: NewSessionInput) => {
      const s = store.create(req);
      setSelectedId(s.id);
      setModal(null);
    },
    [store],
  );

  if (modal === 'quit') {
    return (
      <Box padding={2} borderStyle="double" borderColor="red" flexDirection="column">
        <Text bold color="red">
          quit?
        </Text>
        <Text>There {anyRunning ? 'is' : 'are'} running session(s). Quit anyway?</Text>
        <Text dimColor>y = yes · n = no</Text>
      </Box>
    );
  }

  if (modal === 'new') {
    return (
      <Box padding={1}>
        <NewSessionModal
          defaultCwd={process.cwd()}
          registry={registry}
          onSubmit={onModalSubmit}
          onCancel={() => setModal(null)}
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
          flashId={flashId}
        />
        <Detail session={selected} output={selected ? outputs.get(selected.id) : ''} />
      </Box>
      <StatusBar
        sessions={sessions}
        muted={muted}
        lastNotif={lastNotif}
        hint={
          errorBanner
            ? `! ${errorBanner}`
            : 'n new · c cancel · r reset · d delete · q quit · m mute · j/k nav · Tab focus · Shift+Enter newline'
        }
      />
      <Prompt
        value={input}
        onChange={setInput}
        onSubmit={submitPrompt}
        focused={focus === 'prompt'}
        target={selected ? `${selected.agent}/${selected.label}` : '(no session)'}
      />
    </Box>
  );
}
