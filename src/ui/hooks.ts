import { useStdout } from 'ink';
import { useEffect, useState } from 'react';

export interface TerminalSize {
  rows: number;
  columns: number;
}

/**
 * Returns the current terminal dimensions and re-renders on resize.
 * Falls back to 24×80 if stdout is unavailable (e.g. piped output).
 */
export function useTerminalSize(): TerminalSize {
  const { stdout } = useStdout();
  const [size, setSize] = useState<TerminalSize>({
    rows: stdout?.rows ?? 24,
    columns: stdout?.columns ?? 80,
  });

  useEffect(() => {
    if (!stdout) return;
    const onResize = () => {
      setSize({ rows: stdout.rows ?? 24, columns: stdout.columns ?? 80 });
    };
    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);

  return size;
}
