import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

export interface PromptProps {
  value: string;
  onChange: (v: string) => void;
  focused: boolean;
  target: string;
}

export function Prompt({ value, onChange, focused, target }: PromptProps) {
  return (
    <Box
      borderStyle={focused ? 'double' : 'single'}
      borderColor={focused ? 'cyan' : 'gray'}
      paddingX={1}
      flexDirection="column"
    >
      <Box justifyContent="space-between">
        <Text dimColor>→ {target}</Text>
        <Text color={focused ? 'cyan' : 'yellow'}>
          {focused ? 'typing — Enter to send' : 'press Tab to type'}
        </Text>
      </Box>
      <Box>
        <Text color="green">{'> '}</Text>
        <TextInput value={value} onChange={onChange} focus={focused} />
      </Box>
    </Box>
  );
}
