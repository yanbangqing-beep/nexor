// Width consumed by Prompt's outer Box: borderLeft+borderRight (2) + paddingX*2 (2).
const PROMPT_CHROME_WIDTH = 4;
// "> " sigil rendered before TextInput on the first input line.
const PROMPT_PREFIX_WIDTH = 2;

/**
 * Number of visible rows the Prompt's input area will occupy, accounting for
 * explicit newlines (Shift+Enter, pasted content) and soft wrapping at the
 * Prompt's inner width. Capped at `maxRows` so a giant paste can't push the
 * Detail panel off-screen — the Prompt clips overflow at the same cap.
 */
export function computePromptInputRows(value: string, columns: number, maxRows: number): number {
  const innerWidth = Math.max(1, columns - PROMPT_CHROME_WIDTH);
  if (!value) return 1;

  const lines = value.split('\n');
  let total = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const width = i === 0 ? Math.max(1, innerWidth - PROMPT_PREFIX_WIDTH) : innerWidth;
    total += Math.max(1, Math.ceil(Math.max(1, line.length) / width));
    if (total >= maxRows) return maxRows;
  }
  return Math.min(Math.max(1, total), maxRows);
}
