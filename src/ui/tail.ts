export interface TailFitResult {
  visible: string;
  truncatedAbove: boolean;
}

/**
 * Return the last `maxLines` logical lines of `text`. If the text was
 * trimmed, `truncatedAbove` is true so the caller can render a marker.
 *
 * `maxLines` is treated as a logical-line budget, not visual rows. Lines
 * that wrap to multiple visual rows still count as one. The caller is
 * responsible for constraining the box height so wrapped overflow gets
 * clipped instead of pushing siblings off-screen.
 */
export function tailFit(text: string, maxLines: number): TailFitResult {
  if (maxLines <= 0) return { visible: '', truncatedAbove: text.length > 0 };
  const lines = text.split('\n');
  if (lines.length <= maxLines) return { visible: text, truncatedAbove: false };
  return { visible: lines.slice(-maxLines).join('\n'), truncatedAbove: true };
}
