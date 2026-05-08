import { Box, Text } from 'ink';
import type { Session } from '../types.js';
import { MarkdownView } from './MarkdownView.js';
import { useTerminalSize } from './hooks.js';
import { statusColor, statusIcon } from './sort.js';
import { tailFit } from './tail.js';

export interface DetailProps {
  session: Session | undefined;
  output: string;
  promptInputRows?: number;
}

// Fixed chrome the Detail body shares the screen with, *excluding* the Prompt's
// input rows (which vary with multiline / paste). Composition:
// StatusBar(1) + Prompt border+header+border(3) + Detail border+padding(2)
// + Detail header row(1) + marginTop(1) + safety(1) = 9.
const FIXED_RESERVED_ROWS = 9;
const ERROR_FOOTER_ROWS = 4;

export function Detail({ session, output, promptInputRows = 1 }: DetailProps) {
  const { rows } = useTerminalSize();

  if (!session) {
    return (
      <Box flexGrow={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text dimColor>no session selected · press n to create one</Text>
      </Box>
    );
  }

  const showErrorFooter = session.status === 'error' && Boolean(session.errorMessage);
  const reserved =
    FIXED_RESERVED_ROWS + Math.max(1, promptInputRows) + (showErrorFooter ? ERROR_FOOTER_ROWS : 0);
  const available = Math.max(3, rows - reserved);

  const text = output || '(no output yet — type a prompt and press Enter)';
  const visibleBudget = Math.max(1, available - 1); // leave room for the truncation marker
  const { visible, truncatedAbove } = tailFit(text, visibleBudget);

  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="single" borderColor="gray" paddingX={1}>
      <Box>
        <Text color="cyan" bold>
          {session.agent}
        </Text>
        <Text> · </Text>
        <Text bold>{session.label}</Text>
        <Text dimColor>
          {' '}
          · cwd {session.cwd} · {session.messageCount} msgs ·{' '}
        </Text>
        <Text color={statusColor(session.status)}>
          {statusIcon(session.status)} {session.status}
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column" height={available} flexShrink={1}>
        {truncatedAbove ? <Text dimColor>… (earlier output above) …</Text> : null}
        <MarkdownView text={visible} />
      </Box>
      {showErrorFooter ? (
        <Box
          marginTop={1}
          borderStyle="single"
          borderColor="red"
          paddingX={1}
          flexDirection="column"
        >
          <Text color="red" bold>
            error
          </Text>
          <Text color="red">{session.errorMessage}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
