const MAX_HISTORY = 50;

export interface PromptHistoryStore {
  push(sessionId: string, prompt: string): void;
  up(sessionId: string): string | null;
  down(sessionId: string): string | null;
  resetCursor(sessionId: string): void;
}

export function createPromptHistoryStore(): PromptHistoryStore {
  const histories = new Map<string, string[]>();
  const cursors = new Map<string, number>();

  function getHistory(sessionId: string): string[] {
    return histories.get(sessionId) ?? [];
  }

  function getCursor(sessionId: string): number {
    return cursors.get(sessionId) ?? -1;
  }

  return {
    push(sessionId, prompt) {
      const h = getHistory(sessionId);
      // Don't push duplicates at the tip
      if (h[h.length - 1] !== prompt) {
        h.push(prompt);
        if (h.length > MAX_HISTORY) h.shift();
        histories.set(sessionId, h);
      }
      cursors.set(sessionId, h.length);
    },
    up(sessionId) {
      const h = getHistory(sessionId);
      if (h.length === 0) return null;
      let c = getCursor(sessionId);
      if (c < 0) c = h.length;
      c = Math.max(0, c - 1);
      cursors.set(sessionId, c);
      return h[c] ?? null;
    },
    down(sessionId) {
      const h = getHistory(sessionId);
      if (h.length === 0) return null;
      let c = getCursor(sessionId);
      if (c < 0) c = h.length - 1;
      c = Math.min(h.length, c + 1);
      cursors.set(sessionId, c);
      if (c >= h.length) return null;
      return h[c] ?? null;
    },
    resetCursor(sessionId) {
      cursors.set(sessionId, -1);
    },
  };
}
