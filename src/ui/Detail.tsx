import { Box, Text } from 'ink';
import type { Session } from '../types.js';
import { statusColor, statusIcon } from './sort.js';

export interface DetailProps {
  session: Session | undefined;
  output: string;
}

export function Detail({ session, output }: DetailProps) {
  if (!session) {
    return (
      <Box flexGrow={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text dimColor>no session selected · press n to create one</Text>
      </Box>
    );
  }

  return (
    <Box flexGrow={1} flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
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
      <Box marginTop={1} flexDirection="column" flexGrow={1}>
        <Text>{output || '(no output yet — type a prompt and press Enter)'}</Text>
      </Box>
      {session.status === 'error' && session.errorMessage ? (
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
