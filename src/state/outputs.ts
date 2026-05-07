const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export interface OutputStore {
  get(sessionId: string): string;
  append(sessionId: string, text: string): void;
  clear(sessionId: string): void;
  delete(sessionId: string): void;
  isTruncated(sessionId: string): boolean;
  subscribe(listener: () => void): () => void;
}

export function createOutputStore(): OutputStore {
  const buffers = new Map<string, { text: string; truncated: boolean }>();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const l of listeners) l();
  };

  function getEntry(sessionId: string) {
    let e = buffers.get(sessionId);
    if (!e) {
      e = { text: '', truncated: false };
      buffers.set(sessionId, e);
    }
    return e;
  }

  function enforceCap(entry: { text: string; truncated: boolean }) {
    const byteLength = Buffer.byteLength(entry.text, 'utf8');
    if (byteLength > MAX_BYTES) {
      const excess = byteLength - MAX_BYTES;
      // Remove from the front. Since we can't know exact byte-length of chars
      // without scanning, do a rough slice and re-check.
      let start = 0;
      while (Buffer.byteLength(entry.text.slice(start), 'utf8') > MAX_BYTES) {
        // Advance by ~excess chars, but at least 1
        start += Math.max(1, Math.floor(excess / 4));
      }
      entry.text = entry.text.slice(start);
      entry.truncated = true;
    }
  }

  return {
    get(sessionId) {
      const e = buffers.get(sessionId);
      if (!e) return '';
      return e.truncated ? `[earlier output truncated]\n${e.text}` : e.text;
    },
    append(sessionId, text) {
      const entry = getEntry(sessionId);
      entry.text += text;
      enforceCap(entry);
      notify();
    },
    clear(sessionId) {
      buffers.set(sessionId, { text: '', truncated: false });
      notify();
    },
    delete(sessionId) {
      buffers.delete(sessionId);
      notify();
    },
    isTruncated(sessionId) {
      return buffers.get(sessionId)?.truncated ?? false;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
