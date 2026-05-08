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
  ctrlE: '\x05',
  enter: '\r',
  shiftEnter: '\x1b\r',
  up: '\x1b[A',
  down: '\x1b[B',
  left: '\x1b[D',
  right: '\x1b[C',
  backspace: '\x7f',
} as const;
