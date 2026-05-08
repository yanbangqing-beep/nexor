import { spawn } from 'node:child_process';
import notifier from 'node-notifier';
import type { NotificationEvent } from './router.js';

export function sendDesktopNotification(evt: NotificationEvent) {
  const emoji = evt.type === 'done' ? '✓' : '✗';
  const title = `${emoji} ${evt.session.agent} ${evt.session.label}`;
  const message = `${evt.type === 'done' ? 'Finished' : 'Failed'} · ${evt.session.messageCount} msgs`;

  if (process.platform === 'darwin') {
    // node-notifier ships a vendored terminal-notifier.app whose bundle ID is
    // routinely denied notification permission on modern macOS, so the popup
    // never appears. osascript runs under Script Editor's identity which is
    // already permitted on a default install.
    sendMacNotification(title, message);
    return;
  }

  notifier.notify({ title, message, sound: false }, () => {
    /* swallow: TUI owns stdout/stderr, nowhere safe to log */
  });
}

function sendMacNotification(title: string, message: string) {
  const escapeAppleScript = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const script = `display notification "${escapeAppleScript(message)}" with title "${escapeAppleScript(title)}"`;
  const child = spawn('osascript', ['-e', script], { stdio: 'ignore' });
  child.on('error', () => {
    /* osascript missing — give up silently */
  });
}

export function ringBell() {
  process.stdout.write('\x07');
}
