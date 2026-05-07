import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import YAML from 'yaml';
import type { AgentName } from './types.js';

export interface AgentConfig {
  enabled: boolean;
  binary: string;
}

export interface NotifConfig {
  desktop: boolean;
  bell: boolean;
}

export interface NexorConfig {
  agents: Record<AgentName, AgentConfig>;
  notifications: NotifConfig;
}

const DEFAULT_CONFIG: NexorConfig = {
  agents: {
    claude: { enabled: true, binary: 'claude' },
    codex: { enabled: true, binary: 'codex' },
  },
  notifications: {
    desktop: true,
    bell: true,
  },
};

export async function loadConfig(): Promise<NexorConfig> {
  const configPath = path.join(
    process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'),
    'nexor',
    'config.yaml',
  );

  let raw: string;
  try {
    raw = await fs.readFile(configPath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return DEFAULT_CONFIG;
    }
    throw err;
  }

  const parsed = YAML.parse(raw);
  return mergeWithDefaults(parsed);
}

function mergeWithDefaults(parsed: unknown): NexorConfig {
  if (!parsed || typeof parsed !== 'object') return DEFAULT_CONFIG;
  const p = parsed as Record<string, unknown>;

  const agents = { ...DEFAULT_CONFIG.agents };
  if (p.agents && typeof p.agents === 'object') {
    for (const [key, val] of Object.entries(p.agents)) {
      if (key !== 'claude' && key !== 'codex') continue;
      if (!val || typeof val !== 'object') continue;
      const v = val as Record<string, unknown>;
      agents[key as AgentName] = {
        enabled: typeof v.enabled === 'boolean' ? v.enabled : agents[key as AgentName].enabled,
        binary: typeof v.binary === 'string' ? v.binary : agents[key as AgentName].binary,
      };
    }
  }

  const notifications = { ...DEFAULT_CONFIG.notifications };
  if (p.notifications && typeof p.notifications === 'object') {
    const n = p.notifications as Record<string, unknown>;
    notifications.desktop = typeof n.desktop === 'boolean' ? n.desktop : notifications.desktop;
    notifications.bell = typeof n.bell === 'boolean' ? n.bell : notifications.bell;
  }

  return { agents, notifications };
}
