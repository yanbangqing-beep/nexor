import * as os from 'node:os';
import * as path from 'node:path';
import { render } from 'ink';
import { createElement } from 'react';
import { createDefaultRegistry } from './adapters/registry.js';
import { createNotificationRouter } from './notify/router.js';
import { LockBusyError, acquireLock } from './process/lock.js';
import { createRunner } from './runner.js';
import { createOutputStore } from './state/outputs.js';
import { createDebouncedWriter, loadSessions } from './state/persistence.js';
import { createPromptHistoryStore } from './state/prompt-history.js';
import { createSessionStore } from './state/store.js';
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

  const initial = await loadSessions(sessionsPath);
  const store = createSessionStore(initial);
  const writer = createDebouncedWriter(sessionsPath, 200);
  store.subscribe(() => writer.write(store.list()));
  // Persist initial list (covers fresh-install state)
  writer.write(store.list());

  const outputs = createOutputStore();
  const registry = createDefaultRegistry();
  const runner = createRunner({ store, outputs, adapters: registry });
  const router = createNotificationRouter(store);
  const history = createPromptHistoryStore();

  let cleaned = false;
  const cleanup = async (code = 0) => {
    if (cleaned) return;
    cleaned = true;
    runner.cancelAll();
    try {
      await writer.flush();
    } catch {
      /* best effort */
    }
    await lock.release();
    process.exit(code);
  };
  process.on('SIGINT', () => void cleanup(130));
  process.on('SIGTERM', () => void cleanup(143));
  process.on('exit', () => {
    void lock.release();
  });

  render(createElement(App, { store, outputs, runner, registry, router, history }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
