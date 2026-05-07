import { Box, Text } from 'ink';
import type { Session } from '../types.js';
import { groupByAgent, statusColor, statusIcon, timeAgo } from './sort.js';

export interface SidebarProps {
  sessions: Session[]; // already sorted
  selectedId: string | null;
  focused: boolean;
}

export function Sidebar({ sessions, selectedId, focused }: SidebarProps) {
  const groups = groupByAgent(sessions);

  return (
    <Box
      flexDirection="column"
      width={36}
      borderStyle={focused ? 'double' : 'single'}
      borderColor={focused ? 'cyan' : 'gray'}
      paddingX={1}
    >
      <Text bold>sessions ({sessions.length})</Text>
      {sessions.length === 0 && <Text dimColor>(press n to create)</Text>}
      {Array.from(groups.entries()).map(([agent, list]) => (
        <Box key={agent} flexDirection="column" marginTop={1}>
          <Text color="cyan">
            ▼ {agent} ({list.length})
          </Text>
          {list.map((s) => (
            <Text key={s.id} color={s.id === selectedId ? 'green' : undefined}>
              {s.id === selectedId ? '▸ ' : '  '}
              <Text color={statusColor(s.status)}>{statusIcon(s.status)}</Text> {s.label}{' '}
              <Text dimColor>{timeAgo(s.lastActivity)}</Text>
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  );
}
