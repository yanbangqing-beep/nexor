import { Box, Text } from 'ink';
import { PromptInput, type PromptInputState } from './PromptInput.js';

export interface PromptProps {
  state: PromptInputState;
  onChange: (next: PromptInputState) => void;
  focused: boolean;
  target: string;
  inputRows?: number;
}

export function Prompt({ state, onChange, focused, target, inputRows = 1 }: PromptProps) {
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
          {focused ? 'typing — Enter to send · Ctrl+A/E line start/end' : 'press Tab to type'}
        </Text>
      </Box>
      <Box height={inputRows} overflow="hidden">
        <Text color="green">{'> '}</Text>
        <PromptInput state={state} onChange={onChange} focus={focused} />
      </Box>
    </Box>
  );
}
