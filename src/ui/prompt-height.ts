// Width consumed by Prompt's outer Box: borderLeft+borderRight (2) + paddingX*2 (2).
export const PROMPT_CHROME_WIDTH = 4;
// "> " sigil rendered before TextInput on the first input line.
export const PROMPT_PREFIX_WIDTH = 2;

export function computePromptInputColumns(columns: number): number {
  return Math.max(1, columns - PROMPT_CHROME_WIDTH - PROMPT_PREFIX_WIDTH);
}

function measurePromptInputRows(value: string, columns: number, maxRows: number): number {
  const innerWidth = Math.max(1, columns - PROMPT_CHROME_WIDTH);
  if (!value) return 1;

  const lines = value.split('\n');
  let total = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const width = i === 0 ? Math.max(1, innerWidth - PROMPT_PREFIX_WIDTH) : innerWidth;
    total += Math.max(1, Math.ceil(Math.max(1, line.length) / width));
    if (total > maxRows) return total;
  }
  return Math.max(1, total);
}

/**
 * Number of visible rows the Prompt's input area will occupy, accounting for
 * explicit newlines (Shift+Enter, pasted content) and soft wrapping at the
 * Prompt's inner width. If the input would exceed `maxRows`, it collapses to a
 * one-line summary so a giant paste can't push the Detail panel off-screen.
 */
export function computePromptInputRows(value: string, columns: number, maxRows: number): number {
  if (isPromptInputCollapsed(value, columns, maxRows)) return 1;
  const measured = measurePromptInputRows(value, columns, maxRows);
  return Math.min(measured, maxRows);
}

export function isPromptInputCollapsed(value: string, columns: number, maxRows: number): boolean {
  if (!value) return false;
  const inputColumns = computePromptInputColumns(columns);
  return (
    value.length > inputColumns * 3 || measurePromptInputRows(value, columns, maxRows) > maxRows
  );
}
