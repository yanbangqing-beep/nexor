import { randomUUID } from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import { render } from 'ink';
import { createElement } from 'react';
import { LockBusyError, acquireLock } from './process/lock.js';
import { createDebouncedWriter, loadSessions } from './state/persistence.js';
import { createSessionStore } from './state/store.js';
import type { Session } from './types.js';
import { App } from './ui/App.js';

const dataDir = path.join(
  process.env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local', 'share'),
  'nexor',
);
const sessionsPath = path.join(dataDir, 'sessions.json');
const lockPath = path.join(dataDir, 'nexor.lock');

async function main() {
  let lock: Awaited<ReturnType<typeof acquireLock>>;
  try {
    lock = await acquireLock(lockPath);
  } catch (err) {
    if (err instanceof LockBusyError) {
      console.error(`nexor is already running (pid ${err.pid})`);
      process.exit(1);
    }
    throw err;
  }

  let cleaned = false;
  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    try {
      await writer.flush();
    } catch {
      /* best effort */
    }
    await lock.release();
  };
  process.on('SIGINT', () => void cleanup().then(() => process.exit(130)));
  process.on('SIGTERM', () => void cleanup().then(() => process.exit(143)));
  process.on('exit', () => {
    // sync best-effort
    void lock.release();
  });

  let initial = await loadSessions(sessionsPath);
  if (initial.length === 0) {
    initial = [bootstrapSession()];
  }

  const store = createSessionStore(initial);
  const writer = createDebouncedWriter(sessionsPath, 200);
  store.subscribe(() => writer.write(store.list()));
  writer.write(store.list());

  render(createElement(App, { store }));
}

function bootstrapSession(): Session {
  const now = Date.now();
  return {
    id: randomUUID(),
    agent: 'claude',
    label: 'default',
    cwd: process.cwd(),
    status: 'idle',
    createdAt: now,
    lastActivity: now,
    messageCount: 0,
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
