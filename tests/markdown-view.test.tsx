import { Text } from 'ink';
import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import { MarkdownView } from '../src/ui/MarkdownView.js';

function strip(s: string | undefined): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI
  return (s ?? '').replace(/\x1B\[[0-9;]*m/g, '');
}

describe('MarkdownView', () => {
  it('renders plain text unchanged', () => {
    const { lastFrame } = render(<MarkdownView text="just plain output" />);
    expect(strip(lastFrame())).toBe('just plain output');
  });

  it('renders **bold** with the same emphasis as <Text bold> and strips markers', () => {
    const { lastFrame } = render(<MarkdownView text="hi **bold** end" />);
    const reference = render(
      <Text>
        hi <Text bold>bold</Text> end
      </Text>,
    );
    expect(lastFrame()).toBe(reference.lastFrame());
    expect(lastFrame()).not.toContain('**');
  });

  it('renders *italic* as italic and strips markers', () => {
    const { lastFrame } = render(<MarkdownView text="a *slanted* b" />);
    const reference = render(
      <Text>
        a <Text italic>slanted</Text> b
      </Text>,
    );
    expect(lastFrame()).toBe(reference.lastFrame());
    expect(strip(lastFrame())).toBe('a slanted b');
  });

  it('renders `inline code` with code styling and strips backticks', () => {
    const { lastFrame } = render(<MarkdownView text="run `ls -la` now" />);
    const reference = render(
      <Text>
        run <Text color="cyan">ls -la</Text> now
      </Text>,
    );
    expect(lastFrame()).toBe(reference.lastFrame());
    expect(lastFrame()).not.toContain('`');
  });

  it('renders unordered list items with a bullet glyph', () => {
    const text = ['- one', '- two', '* three'].join('\n');
    const { lastFrame } = render(<MarkdownView text={text} />);
    const stripped = strip(lastFrame());
    // Bullets render as • (or similar) followed by the item text; markers - / * are gone
    expect(stripped).not.toMatch(/^[-*]\s/m);
    expect(stripped).toMatch(/•\s+one/);
    expect(stripped).toMatch(/•\s+two/);
    expect(stripped).toMatch(/•\s+three/);
  });

  it('renders ordered list items with their numbers preserved', () => {
    const text = ['1. first', '2. second'].join('\n');
    const { lastFrame } = render(<MarkdownView text={text} />);
    const stripped = strip(lastFrame());
    expect(stripped).toMatch(/1\.\s+first/);
    expect(stripped).toMatch(/2\.\s+second/);
  });

  it('renders [text](url) with text emphasized and url shown after, dimmed', () => {
    const { lastFrame } = render(<MarkdownView text="see [docs](https://x.io) now" />);
    const stripped = strip(lastFrame());
    expect(stripped).toContain('docs');
    expect(stripped).toContain('https://x.io');
    expect(stripped).not.toContain('[docs]');
    expect(stripped).not.toContain('](');
  });

  it('renders ATX headers (#, ##, ###) bold and strips the # markers', () => {
    const text = ['# H1', '## H2', '### H3', 'plain'].join('\n');
    const { lastFrame } = render(<MarkdownView text={text} />);
    const stripped = strip(lastFrame());
    expect(stripped).toContain('H1');
    expect(stripped).toContain('H2');
    expect(stripped).toContain('H3');
    expect(stripped).toContain('plain');
    expect(stripped).not.toMatch(/^#/m);
    const frame = lastFrame() ?? '';
    // Header lines carry bold ANSI somewhere before the title text on the same line.
    for (const title of ['H1', 'H2', 'H3']) {
      expect(frame).toMatch(new RegExp(`\\x1B\\[1m[^\\n]*${title}`));
    }
  });

  it('renders ``` fenced code blocks with code styling, preserving whitespace', () => {
    const text = ['before', '```', 'const x = 1;', '  indented', '```', 'after'].join('\n');
    const { lastFrame } = render(<MarkdownView text={text} />);
    const stripped = strip(lastFrame());
    // No backticks should leak through
    expect(stripped).not.toMatch(/`/);
    expect(stripped).toContain('const x = 1;');
    expect(stripped).toContain('  indented');
    expect(stripped).toContain('before');
    expect(stripped).toContain('after');
    // The code-block content carries cyan color (same as inline code styling)
    const frame = lastFrame() ?? '';
    // biome-ignore lint/suspicious/noControlCharactersInRegex: matching ANSI codes
    expect(frame).toMatch(/\x1B\[36m[^\x1B]*const x = 1;/);
  });
});
