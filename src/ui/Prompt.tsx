import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

export interface PromptProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  focused: boolean;
  target: string;
}

export function Prompt({ value, onChange, onSubmit, focused, target }: PromptProps) {
  return (
    <Box
      borderStyle={focused ? 'double' : 'single'}
      borderColor={focused ? 'cyan' : 'gray'}
      paddingX={1}
      flexDirection="column"
    >
      <Text dimColor>→ {target}</Text>
      <Box>
        <Text color="green">{'> '}</Text>
        <TextInput value={value} onChange={onChange} onSubmit={onSubmit} focus={focused} />
      </Box>
    </Box>
  );
}
