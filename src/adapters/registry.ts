import type { Adapter, AgentName } from '../types.js';
import { createClaudeAdapter } from './claude.js';
import { createCodexAdapter } from './codex.js';

export type AdapterRegistry = Partial<Record<AgentName, Adapter>>;

export function createDefaultRegistry(): AdapterRegistry {
  return {
    claude: createClaudeAdapter(),
    codex: createCodexAdapter(),
  };
}
