import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';
import { PromptInput } from '../src/ui/PromptInput.js';
import { KEY, pressKey } from './helpers/ink-input.js';

describe('PromptInput', () => {
  it('Ctrl+A moves cursor to start of single-line buffer', async () => {
    const onChange = vi.fn();
    const { stdin } = render(
      <PromptInput state={{ value: 'hello', cursor: 5 }} onChange={onChange} focus />,
    );
    await pressKey(stdin, KEY.ctrlA);
    expect(onChange).toHaveBeenCalledWith({ value: 'hello', cursor: 0 });
  });

  it('Ctrl+E moves cursor to end of single-line buffer', async () => {
    const onChange = vi.fn();
    const { stdin } = render(
      <PromptInput state={{ value: 'hello', cursor: 0 }} onChange={onChange} focus />,
    );
    await pressKey(stdin, KEY.ctrlE);
    expect(onChange).toHaveBeenCalledWith({ value: 'hello', cursor: 5 });
  });

  it('Ctrl+A jumps to start of current logical line in a multiline buffer', async () => {
    // "abc\nxyz" — cursor at position 6 ("y" of "xyz"). Start of line is 4 (after \n).
    const onChange = vi.fn();
    const { stdin } = render(
      <PromptInput state={{ value: 'abc\nxyz', cursor: 6 }} onChange={onChange} focus />,
    );
    await pressKey(stdin, KEY.ctrlA);
    expect(onChange).toHaveBeenCalledWith({ value: 'abc\nxyz', cursor: 4 });
  });

  it('Ctrl+E jumps to end of current logical line in a multiline buffer', async () => {
    // "abc\nxyz\nq" — cursor at 5 ("y" of "xyz"). End of line is 7 (the \n).
    const onChange = vi.fn();
    const { stdin } = render(
      <PromptInput state={{ value: 'abc\nxyz\nq', cursor: 5 }} onChange={onChange} focus />,
    );
    await pressKey(stdin, KEY.ctrlE);
    expect(onChange).toHaveBeenCalledWith({ value: 'abc\nxyz\nq', cursor: 7 });
  });

  it('inserts a printable character at the cursor and advances cursor', async () => {
    const onChange = vi.fn();
    const { stdin } = render(
      <PromptInput state={{ value: 'helo', cursor: 3 }} onChange={onChange} focus />,
    );
    await pressKey(stdin, 'l');
    expect(onChange).toHaveBeenCalledWith({ value: 'hello', cursor: 4 });
  });

  it('backspace deletes the char before the cursor and shifts cursor left', async () => {
    const onChange = vi.fn();
    const { stdin } = render(
      <PromptInput state={{ value: 'hello', cursor: 3 }} onChange={onChange} focus />,
    );
    await pressKey(stdin, KEY.backspace);
    expect(onChange).toHaveBeenCalledWith({ value: 'helo', cursor: 2 });
  });

  it('backspace at cursor 0 is a no-op', async () => {
    const onChange = vi.fn();
    const { stdin } = render(
      <PromptInput state={{ value: 'hello', cursor: 0 }} onChange={onChange} focus />,
    );
    await pressKey(stdin, KEY.backspace);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('left arrow moves cursor one left, clamped at 0', async () => {
    const onChange = vi.fn();
    const { stdin, rerender } = render(
      <PromptInput state={{ value: 'abc', cursor: 2 }} onChange={onChange} focus />,
    );
    await pressKey(stdin, KEY.left);
    expect(onChange).toHaveBeenCalledWith({ value: 'abc', cursor: 1 });

    onChange.mockClear();
    rerender(<PromptInput state={{ value: 'abc', cursor: 0 }} onChange={onChange} focus />);
    await pressKey(stdin, KEY.left);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('right arrow moves cursor one right, clamped at length', async () => {
    const onChange = vi.fn();
    const { stdin, rerender } = render(
      <PromptInput state={{ value: 'abc', cursor: 1 }} onChange={onChange} focus />,
    );
    await pressKey(stdin, KEY.right);
    expect(onChange).toHaveBeenCalledWith({ value: 'abc', cursor: 2 });

    onChange.mockClear();
    rerender(<PromptInput state={{ value: 'abc', cursor: 3 }} onChange={onChange} focus />);
    await pressKey(stdin, KEY.right);
    expect(onChange).not.toHaveBeenCalled();
  });
});
