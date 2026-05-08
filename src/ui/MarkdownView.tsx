import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

export interface MarkdownViewProps {
  text: string;
}

// Order matters: ** before * so bold wins over italic.
const INLINE_PATTERN = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))/g;
const FENCE = '```';

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE_PATTERN)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    if (m[2] !== undefined) {
      out.push(
        <Text key={`${keyPrefix}b${i++}`} bold>
          {m[2]}
        </Text>,
      );
    } else if (m[4] !== undefined) {
      out.push(
        <Text key={`${keyPrefix}i${i++}`} italic>
          {m[4]}
        </Text>,
      );
    } else if (m[6] !== undefined) {
      out.push(
        <Text key={`${keyPrefix}c${i++}`} color="cyan">
          {m[6]}
        </Text>,
      );
    } else if (m[8] !== undefined && m[9] !== undefined) {
      out.push(
        <Text key={`${keyPrefix}lt${i++}`} underline color="blue">
          {m[8]}
        </Text>,
        <Text key={`${keyPrefix}lu${i++}`} dimColor>
          {' ('}
          {m[9]}
          {')'}
        </Text>,
      );
    }
    last = start + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function renderLines(text: string): ReactNode[] {
  const lines = text.split('\n');
  const rendered: ReactNode[] = [];
  let inFence = false;
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx] ?? '';
    if (line.trim() === FENCE) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      rendered.push(
        <Text key={`f${idx}`} color="cyan">
          {line.length === 0 ? ' ' : line}
        </Text>,
      );
      continue;
    }
    const bulletMatch = /^[-*]\s+(.*)$/.exec(line);
    if (bulletMatch) {
      const content = bulletMatch[1] ?? '';
      rendered.push(
        <Text key={`u${idx}`}>
          {'• '}
          {renderInline(content, `u${idx}-`)}
        </Text>,
      );
      continue;
    }
    const headerMatch = /^(#{1,3})\s+(.*)$/.exec(line);
    if (headerMatch) {
      const level = headerMatch[1]?.length ?? 1;
      const title = headerMatch[2] ?? '';
      const color = level === 1 ? 'cyan' : level === 2 ? 'magenta' : 'yellow';
      rendered.push(
        <Text key={`h${idx}`} bold color={color}>
          {title}
        </Text>,
      );
      continue;
    }
    // Empty line still needs a Text so the column has a blank row
    rendered.push(
      <Text key={`l${idx}`}>{line.length === 0 ? ' ' : renderInline(line, `l${idx}-`)}</Text>,
    );
  }
  return rendered;
}

export function MarkdownView({ text }: MarkdownViewProps) {
  const lines = renderLines(text);
  if (lines.length === 1) {
    return <>{lines[0]}</>;
  }
  return <Box flexDirection="column">{lines}</Box>;
}
