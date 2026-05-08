import { Text, useInput } from 'ink';

export interface PromptInputState {
  value: string;
  cursor: number;
}

export interface PromptInputProps {
  state: PromptInputState;
  onChange: (next: PromptInputState) => void;
  onSubmit?: (value: string) => void;
  focus: boolean;
}

export function PromptInput({ state, onChange, focus }: PromptInputProps) {
  useInput(
    (input, key) => {
      if (key.ctrl && input === 'a') {
        const before = state.value.slice(0, state.cursor);
        const lastNL = before.lastIndexOf('\n');
        const lineStart = lastNL < 0 ? 0 : lastNL + 1;
        onChange({ value: state.value, cursor: lineStart });
        return;
      }
      if (key.ctrl && input === 'e') {
        const after = state.value.slice(state.cursor);
        const nextNL = after.indexOf('\n');
        const lineEnd = nextNL < 0 ? state.value.length : state.cursor + nextNL;
        onChange({ value: state.value, cursor: lineEnd });
        return;
      }
      // Skip keys handled at the App level: Enter, Shift+Enter, Up/Down (history), Tab.
      if (key.return || key.upArrow || key.downArrow || key.tab) return;
      if (key.leftArrow) {
        if (state.cursor === 0) return;
        onChange({ value: state.value, cursor: state.cursor - 1 });
        return;
      }
      if (key.rightArrow) {
        if (state.cursor >= state.value.length) return;
        onChange({ value: state.value, cursor: state.cursor + 1 });
        return;
      }
      if (key.backspace || key.delete) {
        if (state.cursor === 0) return;
        const next = state.value.slice(0, state.cursor - 1) + state.value.slice(state.cursor);
        onChange({ value: next, cursor: state.cursor - 1 });
        return;
      }
      // Insert printable character at cursor.
      if (input && !key.ctrl && !key.meta) {
        const next = state.value.slice(0, state.cursor) + input + state.value.slice(state.cursor);
        onChange({ value: next, cursor: state.cursor + input.length });
        return;
      }
    },
    { isActive: focus },
  );

  const before = state.value.slice(0, state.cursor);
  const at = state.value.slice(state.cursor, state.cursor + 1) || ' ';
  const after = state.value.slice(state.cursor + 1);
  return (
    <Text>
      {before}
      {focus ? <Text inverse>{at}</Text> : at}
      {after}
    </Text>
  );
}
