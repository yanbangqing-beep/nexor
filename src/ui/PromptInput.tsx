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
  collapsed?: boolean;
  maxColumns?: number;
}

function isSingleControlChar(input: string): boolean {
  if (input.length !== 1) return false;
  const code = input.charCodeAt(0);
  return code <= 31 || code === 127;
}

function truncateEnd(value: string, maxColumns: number): string {
  if (maxColumns <= 0) return '';
  if (value.length <= maxColumns) return value;
  if (maxColumns <= 3) return '.'.repeat(maxColumns);
  return `${value.slice(0, maxColumns - 3)}...`;
}

export function formatCollapsedPromptInput(value: string, maxColumns: number): string {
  const columns = Math.max(1, maxColumns);
  const lineCount = value.split('\n').length;
  const compact = value.replace(/\s+/g, ' ').trim();
  const suffix =
    lineCount > 1
      ? ` ... [${lineCount} lines, ${value.length} chars]`
      : ` ... [${value.length} chars]`;

  if (suffix.length >= columns) {
    return truncateEnd(suffix.trimStart(), columns);
  }

  return `${truncateEnd(compact, columns - suffix.length)}${suffix}`;
}

export function PromptInput({
  state,
  onChange,
  focus,
  collapsed = false,
  maxColumns = 80,
}: PromptInputProps) {
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
      // Skip keys handled at the App level: Enter, Shift+Enter, Up/Down
      // (history), Tab, ESC. Some terminals don't set key.tab on Tab and only
      // expose it as '\t' in `input` — guard for that too.
      // CJK IME confirmation may send key.return alongside the composed
      // character; only skip when return is pressed without a character.
      if ((key.return && !input) || key.upArrow || key.downArrow || key.tab || key.escape) return;
      if (input === '\t' || input === '\x1b') return;
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
      // NOTE: we deliberately do NOT guard on `key.meta`. Some CJK IMEs
      // (Squirrel, macOS Pinyin, etc.) send composed characters with the meta
      // flag set because the underlying bytes are parsed as an escape sequence
      // by ink’s keypress parser. Dropping meta would silently swallow the
      // character on the first composition. We only reject pure control chars.
      if (input && !key.ctrl && !isSingleControlChar(input)) {
        const next = state.value.slice(0, state.cursor) + input + state.value.slice(state.cursor);
        onChange({ value: next, cursor: state.cursor + input.length });
        return;
      }
    },
    { isActive: focus },
  );

  if (collapsed) {
    const cursor = focus ? ' ' : '';
    const display = formatCollapsedPromptInput(
      state.value,
      Math.max(1, maxColumns - cursor.length),
    );
    return (
      <Text>
        {display}
        {focus && <Text inverse>{cursor}</Text>}
      </Text>
    );
  }

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
