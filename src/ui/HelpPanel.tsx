import { Box, Text } from 'ink';

interface Row {
  keys: string;
  desc: string;
}

const GLOBAL_KEYS: Row[] = [
  { keys: '↑  ↓', desc: 'navigate sessions (any focus)' },
  { keys: 'Tab', desc: 'switch focus' },
  { keys: 'm', desc: 'toggle desktop / bell mute' },
  { keys: 'q', desc: 'quit' },
];

const SIDEBAR_KEYS: Row[] = [
  { keys: 'n', desc: 'new session' },
  { keys: 'e', desc: 'edit cwd of selected session' },
  { keys: 'c', desc: 'cancel current run' },
  { keys: 'r', desc: 'reset (clear context + transcript)' },
  { keys: 'd', desc: 'delete session' },
  { keys: 'j  k', desc: 'navigate sessions' },
];

const PROMPT_KEYS: Row[] = [
  { keys: 'Enter', desc: 'send prompt' },
  { keys: 'Shift+Enter', desc: 'insert newline' },
  { keys: 'Alt+↑  Alt+↓', desc: 'recall previous / next prompt' },
];

const SLASH_COMMANDS: Row[] = [
  { keys: '/clear', desc: "clear current session's conversation context" },
  { keys: '/h  /help', desc: 'show this help' },
];

function Section({ title, rows, keyWidth }: { title: string; rows: Row[]; keyWidth: number }) {
  return (
    <Box marginTop={1} flexDirection="column">
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
  const keyWidth = 14;
  return (
    <Box
      borderStyle="double"
      borderColor="cyan"
      flexDirection="column"
      paddingX={2}
      paddingY={1}
      width={70}
    >
      <Box justifyContent="space-between">
        <Text bold>nexor · help</Text>
        <Text dimColor>esc / Enter / q to close</Text>
      </Box>

      <Section title="global" rows={GLOBAL_KEYS} keyWidth={keyWidth} />
      <Section title="sidebar" rows={SIDEBAR_KEYS} keyWidth={keyWidth} />
      <Section title="prompt" rows={PROMPT_KEYS} keyWidth={keyWidth} />
      <Section title="slash commands" rows={SLASH_COMMANDS} keyWidth={keyWidth} />
    </Box>
  );
}
