interface StdinLike {
  write: (data: string) => void;
}

const tick = () => new Promise((r) => setTimeout(r, 30));

export async function pressKey(stdin: StdinLike, sequence: string): Promise<void> {
  await tick();
  stdin.write(sequence);
  await tick();
}

export const KEY = {
  ctrlA: '\x01',
  ctrlC: '\x03',
  ctrlE: '\x05',
  enter: '\r',
  shiftEnter: '\x1b\r',
  up: '\x1b[A',
  down: '\x1b[B',
  altUp: '\x1b[1;3A',
  altDown: '\x1b[1;3B',
  left: '\x1b[D',
  right: '\x1b[C',
  backspace: '\x7f',
  escape: '\x1b',
} as const;
