import * as os from 'node:os';
import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdapterRegistry } from '../adapters/registry.js';
import type { NotifConfig } from '../config.js';
import { ringBell, sendDesktopNotification } from '../notify/desktop.js';
import type { NotificationEvent, NotificationRouter } from '../notify/router.js';
import { type Runner, SessionBusyError } from '../runner.js';
import type { OutputStore } from '../state/outputs.js';
import type { PromptHistoryStore } from '../state/prompt-history.js';
import type { SessionStore } from '../state/store.js';
import type { Session } from '../types.js';
import { Detail } from './Detail.js';
import { HelpPanel } from './HelpPanel.js';
import { type NewSessionInput, NewSessionModal } from './NewSessionModal.js';
import { Prompt } from './Prompt.js';
import { Sidebar } from './Sidebar.js';
import { StatusBar } from './StatusBar.js';
import { useTerminalSize } from './hooks.js';
import {
  computePromptInputColumns,
  computePromptInputRows,
  isPromptInputCollapsed,
} from './prompt-height.js';
import { flattenByGroup, sortSessions } from './sort.js';

export interface AppProps {
  store: SessionStore;
  outputs: OutputStore;
  runner: Runner;
  registry: AdapterRegistry;
  router: NotificationRouter;
  history: PromptHistoryStore;
  config: NotifConfig;
}

type Focus = 'sidebar' | 'prompt';
type Modal = 'new' | 'quit' | 'edit-cwd' | null;

function expandHome(p: string): string {
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return `${os.homedir()}/${p.slice(2)}`;
  return p;
}

function isPrintableInput(
  char: string | undefined,
  key: { ctrl?: boolean; meta?: boolean },
): char is string {
  // NOTE: do NOT filter on key.meta. CJK IMEs (Squirrel, macOS Pinyin) send
  // composed chars with key.meta=true because their UTF-8 bytes are misparsed
  // as ESC-prefixed sequences by ink's keypress parser. Same reasoning as
  // PromptInput.tsx — drop only pure control chars.
  if (!char || key.ctrl) return false;
  if (char.length !== 1) return true;
  const code = char.charCodeAt(0);
  return code > 31 && code !== 127;
}

function hasPrintableChar(char: string | undefined): boolean {
  if (!char) return false;
  if (char.length > 1) return true;
  const code = char.charCodeAt(0);
  return code > 31 && code !== 127;
}

export function App({ store, outputs, runner, registry, router, history, config }: AppProps) {
  const { exit } = useApp();
  const [sessions, setSessions] = useState<Session[]>(store.list());
  const [, setOutputTick] = useState(0);
  const [focus, setFocus] = useState<Focus>('prompt');
  const [selectedId, setSelectedId] = useState<string | null>(sessions[0]?.id ?? null);
  const [modal, setModal] = useState<Modal>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [input, setInput] = useState<{ value: string; cursor: number }>({ value: '', cursor: 0 });
  const [cwdEdit, setCwdEdit] = useState('');
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
        if (config.desktop) sendDesktopNotification(evt);
        if (config.bell) ringBell();
      }
    });
  }, [router, muted, config.desktop, config.bell]);

  const { rows, columns } = useTerminalSize();
  const promptCap = Math.max(1, Math.min(8, Math.floor(rows / 2)));
  const promptInputRows = computePromptInputRows(input.value, columns, promptCap);
  const promptInputColumns = computePromptInputColumns(columns);
  const promptInputCollapsed = isPromptInputCollapsed(input.value, columns, promptCap);

  // `sorted` drives sort priority (running first, then by activity), and is
  // then re-arranged into agent-grouped order for both rendering and j/k
  // navigation so the cursor walks the same order the user sees.
  const sorted = sortSessions(sessions);
  const visualOrder = flattenByGroup(sorted);
  if (selectedId && !visualOrder.some((s) => s.id === selectedId)) {
    setTimeout(() => setSelectedId(visualOrder[0]?.id ?? null), 0);
  }
  const selectedIdx = visualOrder.findIndex((s) => s.id === selectedId);
  const selected = selectedIdx >= 0 ? visualOrder[selectedIdx] : visualOrder[0];

  const anyRunning = sessions.some((s) => s.status === 'working');
  const cycleSession = (delta: number) => {
    if (visualOrder.length === 0) return;
    const cur = Math.max(0, selectedIdx);
    const n = visualOrder.length;
    const next = (cur + delta + n) % n;
    setSelectedId(visualOrder[next]?.id ?? null);
  };

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
    if (modal === 'edit-cwd') {
      if (key.escape) setModal(null);
      return;
    }
    if (modal === 'new') return;

    if (showHelp && (key.escape || key.return || char === 'q')) {
      setShowHelp(false);
      return;
    }

    if (focus === 'prompt' && key.ctrl && char === 'c') {
      setInput({ value: '', cursor: 0 });
      return;
    }

    // Ctrl+C exits from command mode.
    if (key.ctrl && char === 'c') {
      runner.cancelAll();
      exit();
      return;
    }

    if (key.meta && (key.upArrow || key.downArrow)) {
      cycleSession(key.upArrow ? -1 : 1);
      return;
    }

    // Tab / Shift+Tab cycle through sessions in any mode.
    // Some terminals report Tab via `key.tab`, others via `char === '\t'`.
    if (key.tab || char === '\t') {
      cycleSession(key.shift ? -1 : 1);
      return;
    }

    // ESC enters command mode (vim-style). Already handled by modals above.
    // CJK IME confirmation may set key.escape alongside a composed character
    // (ink's keypress parser misreads the leading UTF-8 byte as ESC). Only
    // switch to command mode when ESC arrives without a printable char.
    if (key.escape && !hasPrintableChar(char)) {
      setFocus('sidebar');
      return;
    }

    if (focus === 'prompt') {
      // INSERT mode — typing flows into PromptInput; only intercept history,
      // submit, and newline. All other keys fall through.
      if (key.shift && key.return) {
        setInput((s) => ({ value: `${s.value}\n`, cursor: s.value.length + 1 }));
        return;
      }
      // CJK IME confirmation may send key.return alongside the composed
      // character. Only submit when Enter is pressed without a printable char.
      if (key.return && !hasPrintableChar(char)) {
        submitPrompt(input.value);
        return;
      }
      if (key.upArrow) {
        const h = history.up(selected?.id ?? '');
        if (h !== null) setInput({ value: h, cursor: h.length });
        return;
      }
      if (key.downArrow) {
        const h = history.down(selected?.id ?? '');
        if (h !== null) setInput({ value: h, cursor: h.length });
        return;
      }
      return;
    }

    // COMMAND mode (focus === 'sidebar') — hotkeys first; any other printable
    // character starts prompt input and keeps that first character.
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
    if (key.upArrow || char === 'k') {
      if (visualOrder.length > 0) {
        const next = Math.max(0, selectedIdx - 1);
        setSelectedId(visualOrder[next]?.id ?? null);
      }
      return;
    }
    if (key.downArrow || char === 'j') {
      if (visualOrder.length > 0) {
        const next = Math.min(visualOrder.length - 1, Math.max(0, selectedIdx) + 1);
        setSelectedId(visualOrder[next]?.id ?? null);
      }
      return;
    }
    if (char === 'n') {
      setModal('new');
    } else if (char === 'c') {
      if (selected) runner.cancel(selected.id);
    } else if (char === 'r') {
      if (selected) runner.reset(selected.id);
    } else if (char === 'd') {
      if (selected) runner.delete(selected.id);
    } else if (char === 'e') {
      if (selected) {
        setCwdEdit(selected.cwd);
        setModal('edit-cwd');
      }
    } else if (isPrintableInput(char, key)) {
      setFocus('prompt');
      setInput((s) => ({
        value: s.value.slice(0, s.cursor) + char + s.value.slice(s.cursor),
        cursor: s.cursor + char.length,
      }));
    }
  });

  const submitPrompt = useCallback(
    (value: string) => {
      const v = value.trim();
      if (!v || !selected) return;
      setInput({ value: '', cursor: 0 });
      setErrorBanner(null);

      if (v === '/h' || v === '/help') {
        setShowHelp(true);
        return;
      }

      if (v === '/clear') {
        runner.reset(selected.id);
        outputs.append(selected.id, '[context cleared]\n');
        history.resetCursor(selected.id);
        return;
      }

      history.push(selected.id, v);
      history.resetCursor(selected.id);
      runner.run(selected.id, v).catch((err: Error) => {
        if (err instanceof SessionBusyError) return;
        setErrorBanner(err.message);
      });
    },
    [selected, runner, history, outputs],
  );

  const onModalSubmit = useCallback(
    (req: NewSessionInput) => {
      const s = store.create(req);
      setSelectedId(s.id);
      setModal(null);
      setFocus('prompt');
    },
    [store],
  );

  const submitCwdEdit = useCallback(
    (raw: string) => {
      if (!selected) {
        setModal(null);
        return;
      }
      const next = expandHome(raw.trim());
      if (next.length > 0 && next !== selected.cwd) {
        store.update(selected.id, { cwd: next });
      }
      setModal(null);
    },
    [selected, store],
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

  if (modal === 'edit-cwd' && selected) {
    return (
      <Box padding={1}>
        <Box
          borderStyle="double"
          borderColor="yellow"
          flexDirection="column"
          paddingX={2}
          paddingY={1}
          width={70}
        >
          <Text bold>edit cwd · {selected.label}</Text>
          <Box marginTop={1}>
            <Text color="green">cwd: </Text>
            <TextInput value={cwdEdit} onChange={setCwdEdit} onSubmit={submitCwdEdit} />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Enter to save · esc to cancel · ~ expands to home</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      <Box flexGrow={1}>
        <Sidebar
          sessions={visualOrder}
          selectedId={selected?.id ?? null}
          focused={focus === 'sidebar'}
          flashId={flashId}
        />
        {showHelp ? (
          <HelpPanel />
        ) : (
          <Detail
            session={selected}
            output={selected ? outputs.get(selected.id) : ''}
            promptInputRows={promptInputRows}
          />
        )}
      </Box>
      <StatusBar
        sessions={sessions}
        muted={muted}
        lastNotif={lastNotif}
        hint={
          errorBanner
            ? `! ${errorBanner}`
            : showHelp
              ? 'HELP · esc/q/Enter close · /clear reset context'
              : focus === 'prompt'
                ? 'INSERT · ↑↓ history · Alt+↑↓ sessions · Tab next · ESC commands'
                : 'COMMAND · ↑↓/j/k sessions · Alt+↑↓ sessions · Tab next · q quit'
        }
      />
      <Prompt
        state={input}
        onChange={setInput}
        focused={focus === 'prompt'}
        target={selected ? `${selected.agent}/${selected.label}` : '(no session)'}
        inputRows={promptInputRows}
        inputColumns={promptInputColumns}
        inputCollapsed={promptInputCollapsed}
      />
    </Box>
  );
}
