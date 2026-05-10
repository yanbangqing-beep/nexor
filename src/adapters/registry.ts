import type { NexorConfig } from '../config.js';
import type { Adapter, AgentName } from '../types.js';
import { createAliceAdapter } from './alice.js';
import { createClaudeAdapter } from './claude.js';
import { createCodexAdapter } from './codex.js';

export type AdapterRegistry = Partial<Record<AgentName, Adapter>>;

export function createRegistry(config: NexorConfig): AdapterRegistry {
  const registry: AdapterRegistry = {};
  if (config.agents.claude?.enabled) {
    registry.claude = createClaudeAdapter({ binary: config.agents.claude.binary });
  }
  if (config.agents.codex?.enabled) {
    registry.codex = createCodexAdapter({ binary: config.agents.codex.binary });
  }
  if (config.agents.alice?.enabled) {
    registry.alice = createAliceAdapter({ binary: config.agents.alice.binary });
  }
  return registry;
}
