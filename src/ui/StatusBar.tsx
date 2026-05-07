import { Box, Text } from 'ink';
import type { Session } from '../types.js';

export interface StatusBarProps {
  sessions: Session[];
  muted: boolean;
  hint?: string;
}

export function StatusBar({ sessions, muted, hint }: StatusBarProps) {
  const running = sessions.filter((s) => s.status === 'working').length;
  const idle = sessions.filter((s) => s.status === 'idle').length;
  const done = sessions.filter((s) => s.status === 'done').length;
  const error = sessions.filter((s) => s.status === 'error').length;

  return (
    <Box paddingX={1} justifyContent="space-between">
      <Text dimColor>
        {running} running · {idle} idle · {done} done · {error} error
      </Text>
      <Text dimColor>{hint ?? 'n new · j/k navigate · Tab focus · ctrl+c quit'}</Text>
      <Text>{muted ? '🔇 muted' : '🔔'}</Text>
    </Box>
  );
}
