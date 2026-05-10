import type { Session } from '../types.js';

/**
 * Sort sessions: running first, then by lastActivity descending.
 */
export function sortSessions(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => {
    const aRun = a.status === 'working' ? 0 : 1;
    const bRun = b.status === 'working' ? 0 : 1;
    if (aRun !== bRun) return aRun - bRun;
    return b.lastActivity - a.lastActivity;
  });
}

export function groupByAgent(sessions: Session[]): Map<string, Session[]> {
  const groups = new Map<string, Session[]>();
  for (const s of sessions) {
    const list = groups.get(s.agent) ?? [];
    list.push(s);
    groups.set(s.agent, list);
  }
  return groups;
}

/**
 * Returns sessions in the same order the Sidebar renders them: grouped by
 * agent (in first-seen order), preserving the input ordering inside each
 * group. j/k navigation MUST walk this list, not the flat `sortSessions`
 * output, otherwise the cursor jumps across groups in the visible UI.
 */
export function flattenByGroup(sessions: Session[]): Session[] {
  const groups = groupByAgent(sessions);
  const out: Session[] = [];
  for (const list of groups.values()) out.push(...list);
  return out;
}

export function statusIcon(status: Session['status']): string {
  switch (status) {
    case 'working':
      return '⟳';
    case 'done':
      return '✓';
    case 'error':
      return '✗';
    default:
      return '○';
  }
}

export function statusColor(status: Session['status']): string | undefined {
  switch (status) {
    case 'working':
      return 'yellow';
    case 'done':
      return 'green';
    case 'error':
      return 'red';
    default:
      return undefined;
  }
}

export function timeAgo(epoch: number, now: number = Date.now()): string {
  const sec = Math.floor((now - epoch) / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
}
