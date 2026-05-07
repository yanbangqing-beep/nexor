export interface OutputStore {
  get(sessionId: string): string;
  append(sessionId: string, text: string): void;
  clear(sessionId: string): void;
  delete(sessionId: string): void;
  subscribe(listener: () => void): () => void;
}

/**
 * Per-session in-memory output buffer.
 * Slice 7 will add the 5 MB ring-buffer cap.
 */
export function createOutputStore(): OutputStore {
  const buffers = new Map<string, string>();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const l of listeners) l();
  };

  return {
    get(sessionId) {
      return buffers.get(sessionId) ?? '';
    },
    append(sessionId, text) {
      buffers.set(sessionId, (buffers.get(sessionId) ?? '') + text);
      notify();
    },
    clear(sessionId) {
      buffers.set(sessionId, '');
      notify();
    },
    delete(sessionId) {
      buffers.delete(sessionId);
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
