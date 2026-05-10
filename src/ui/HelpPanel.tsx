import { Box, Text } from 'ink';
import { useTerminalSize } from './hooks.js';

interface Row {
  keys: string;
  desc: string;
}

const SLASH_COMMANDS: Row[] = [
  { keys: '/h  /help', desc: 'show all commands' },
  { keys: '/clear', desc: "clear current session's conversation context" },
];

const GLOBAL_KEYS: Row[] = [
  { keys: 'ESC', desc: 'enter COMMAND mode' },
  { keys: 'Alt+↑ / ↓', desc: 'previous / next session' },
  { keys: 'Tab', desc: 'next session (cycles)' },
  { keys: 'Shift+Tab', desc: 'previous session (cycles)' },
];

const INSERT_KEYS: Row[] = [
  { keys: 'Enter', desc: 'send prompt' },
  { keys: 'Shift+Enter', desc: 'insert newline' },
  { keys: '↑  ↓', desc: 'previous / next prompt history' },
  { keys: 'Ctrl+A / E', desc: 'jump to line start / end' },
  { keys: 'Ctrl+C', desc: 'clear prompt input' },
];

const COMMAND_KEYS: Row[] = [
  { keys: 'typing', desc: 'start INSERT mode and keep first character' },
  { keys: 'n', desc: 'new session' },
  { keys: 'e', desc: 'edit cwd of selected session' },
  { keys: 'c', desc: 'cancel current run' },
  { keys: 'r', desc: 'reset (clear context + transcript)' },
  { keys: 'd', desc: 'delete session' },
  { keys: 'm', desc: 'toggle desktop / bell mute' },
  { keys: 'q', desc: 'quit' },
  { keys: 'j  k  ↑  ↓', desc: 'navigate sessions' },
];

const MODAL_KEYS: Row[] = [
  { keys: 'new: Enter', desc: 'create session' },
  { keys: 'new: Esc', desc: 'cancel new session' },
  { keys: 'edit: Enter', desc: 'save cwd' },
  { keys: 'edit: Esc', desc: 'cancel cwd edit' },
  { keys: 'quit: y / n', desc: 'confirm / cancel quit' },
];

function Section({ title, rows, keyWidth }: { title: string; rows: Row[]; keyWidth: number }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">
        {title}
      </Text>
      {rows.map((r) => (
        <Box key={r.keys}>
          <Box width={keyWidth}>
            <Text color="green">{r.keys}</Text>
          </Box>
          <Text dimColor>{r.desc}</Text>
        </Box>
      ))}
    </Box>
  );
}

export function HelpPanel() {
  const { columns } = useTerminalSize();
  const compact = columns < 100;
  const keyWidth = compact ? 15 : 16;
  const left = (
    <Box flexDirection="column" flexGrow={1} marginRight={compact ? 0 : 2}>
      <Section title="slash commands" rows={SLASH_COMMANDS} keyWidth={keyWidth} />
      <Section title="global navigation" rows={GLOBAL_KEYS} keyWidth={keyWidth} />
      <Section title="INSERT mode" rows={INSERT_KEYS} keyWidth={keyWidth} />
    </Box>
  );
  const right = (
    <Box flexDirection="column" flexGrow={1}>
      <Section title="COMMAND mode" rows={COMMAND_KEYS} keyWidth={keyWidth} />
      <Section title="modal controls" rows={MODAL_KEYS} keyWidth={keyWidth} />
    </Box>
  );

  return (
    <Box borderStyle="single" borderColor="cyan" flexDirection="column" flexGrow={1} paddingX={1}>
      <Box justifyContent="space-between">
        <Text color="cyan" bold>
          help
        </Text>
        <Text dimColor>all commands · esc / Enter / q close</Text>
      </Box>

      <Box marginTop={1} flexDirection={compact ? 'column' : 'row'}>
        {left}
        {right}
      </Box>
    </Box>
  );
}
