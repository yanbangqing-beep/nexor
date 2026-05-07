import { describe, expect, it } from 'vitest';
import type { Session } from '../src/types.js';
import { groupByAgent, sortSessions, statusIcon, timeAgo } from '../src/ui/sort.js';

const mk = (
  id: string,
  status: Session['status'],
  lastActivity: number,
  agent: Session['agent'] = 'claude',
): Session => ({
  id,
  agent,
  label: id,
  cwd: '/c',
  status,
  createdAt: 0,
  lastActivity,
  messageCount: 0,
});

describe('sortSessions', () => {
  it('places running sessions before non-running', () => {
    const sorted = sortSessions([mk('a', 'idle', 10), mk('b', 'working', 1)]);
    expect(sorted.map((s) => s.id)).toEqual(['b', 'a']);
  });

  it('orders within same status by lastActivity descending', () => {
    const sorted = sortSessions([
      mk('older', 'done', 1),
      mk('newer', 'done', 100),
      mk('mid', 'done', 50),
    ]);
    expect(sorted.map((s) => s.id)).toEqual(['newer', 'mid', 'older']);
  });

  it('does not mutate the input array', () => {
    const input = [mk('a', 'idle', 1), mk('b', 'working', 2)];
    sortSessions(input);
    expect(input.map((s) => s.id)).toEqual(['a', 'b']);
  });
});

describe('groupByAgent', () => {
  it('groups sessions by agent name preserving input order', () => {
    const groups = groupByAgent([
      mk('a', 'idle', 1, 'claude'),
      mk('b', 'idle', 1, 'codex'),
      mk('c', 'idle', 1, 'claude'),
    ]);
    expect(groups.get('claude')?.map((s) => s.id)).toEqual(['a', 'c']);
    expect(groups.get('codex')?.map((s) => s.id)).toEqual(['b']);
  });
});

describe('statusIcon', () => {
  it('maps every status to a single character', () => {
    expect(statusIcon('idle')).toHaveLength(1);
    expect(statusIcon('working')).toHaveLength(1);
    expect(statusIcon('done')).toHaveLength(1);
    expect(statusIcon('error')).toHaveLength(1);
  });
});

describe('timeAgo', () => {
  it('shows "just now" under 5s', () => {
    expect(timeAgo(1000, 1000)).toBe('just now');
  });
  it('shows seconds under 1m', () => {
    expect(timeAgo(0, 30_000)).toBe('30s');
  });
  it('shows minutes under 1h', () => {
    expect(timeAgo(0, 5 * 60_000)).toBe('5m');
  });
  it('shows hours under 1d', () => {
    expect(timeAgo(0, 3 * 3600_000)).toBe('3h');
  });
  it('shows days at >= 1d', () => {
    expect(timeAgo(0, 2 * 86400_000)).toBe('2d');
  });
});
