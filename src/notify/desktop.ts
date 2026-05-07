import notifier from 'node-notifier';
import type { NotificationEvent } from './router.js';

export function sendDesktopNotification(evt: NotificationEvent) {
  const emoji = evt.type === 'done' ? '✓' : '✗';
  notifier.notify({
    title: `${emoji} ${evt.session.agent} ${evt.session.label}`,
    message: `${evt.type === 'done' ? 'Finished' : 'Failed'} · ${evt.session.messageCount} msgs`,
    sound: false, // we handle the bell separately
  });
}

export function ringBell() {
  process.stdout.write('\x07');
}
