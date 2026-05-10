import { Box, Text } from 'ink';
import { PromptInput, type PromptInputState } from './PromptInput.js';

export interface PromptProps {
  state: PromptInputState;
  onChange: (next: PromptInputState) => void;
  focused: boolean;
  target: string;
  inputRows?: number;
  inputColumns?: number;
  inputCollapsed?: boolean;
}

export function Prompt({
  state,
  onChange,
  focused,
  target,
  inputRows = 1,
  inputColumns = 80,
  inputCollapsed = false,
}: PromptProps) {
  return (
    <Box
      borderStyle={focused ? 'double' : 'single'}
      borderColor={focused ? 'cyan' : 'gray'}
      paddingX={1}
      flexDirection="column"
      flexShrink={0}
    >
      <Box justifyContent="space-between">
        <Text dimColor>→ {target}</Text>
        <Text color={focused ? 'cyan' : 'yellow'}>
          {focused
            ? '-- INSERT --  ↑↓ history · Alt+↑↓ sessions · Ctrl+C clear'
            : '-- COMMAND --  ↑↓/j/k sessions · type to insert'}
        </Text>
      </Box>
      <Box height={inputRows} overflow="hidden">
        <Text color="green">{'> '}</Text>
        <PromptInput
          state={state}
          onChange={onChange}
          focus={focused}
          collapsed={inputCollapsed}
          maxColumns={inputColumns}
        />
      </Box>
    </Box>
  );
}
