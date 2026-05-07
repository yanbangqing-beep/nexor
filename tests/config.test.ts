import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

let tmpDir: string;
let prevXdg: string | undefined;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexor-cfg-test-'));
  prevXdg = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = tmpDir;
});

afterEach(async () => {
  if (prevXdg === undefined) Reflect.deleteProperty(process.env, 'XDG_CONFIG_HOME');
  else process.env.XDG_CONFIG_HOME = prevXdg;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function writeConfig(yaml: string) {
  const dir = path.join(tmpDir, 'nexor');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'config.yaml'), yaml);
}

describe('loadConfig', () => {
  it('returns defaults when the config file does not exist', async () => {
    const cfg = await loadConfig();
    expect(cfg.agents.claude).toEqual({ enabled: true, binary: 'claude' });
    expect(cfg.agents.codex).toEqual({ enabled: true, binary: 'codex' });
    expect(cfg.notifications).toEqual({ desktop: true, bell: true });
  });

  it('overrides agent binary while keeping enabled default', async () => {
    await writeConfig(`
agents:
  claude:
    binary: /opt/bin/claude
`);
    const cfg = await loadConfig();
    expect(cfg.agents.claude).toEqual({ enabled: true, binary: '/opt/bin/claude' });
    expect(cfg.agents.codex).toEqual({ enabled: true, binary: 'codex' });
  });

  it('disables an agent when enabled: false', async () => {
    await writeConfig(`
agents:
  codex:
    enabled: false
`);
    const cfg = await loadConfig();
    expect(cfg.agents.codex.enabled).toBe(false);
    expect(cfg.agents.claude.enabled).toBe(true);
  });

  it('overrides notification booleans independently', async () => {
    await writeConfig(`
notifications:
  desktop: false
  bell: true
`);
    const cfg = await loadConfig();
    expect(cfg.notifications).toEqual({ desktop: false, bell: true });
  });

  it('ignores unknown agent keys without throwing', async () => {
    await writeConfig(`
agents:
  alice:
    enabled: true
    binary: alice
`);
    const cfg = await loadConfig();
    expect(cfg.agents.claude).toEqual({ enabled: true, binary: 'claude' });
    expect(cfg.agents.codex).toEqual({ enabled: true, binary: 'codex' });
    expect((cfg.agents as Record<string, unknown>).alice).toBeUndefined();
  });

  it('ignores non-object agent values and keeps defaults', async () => {
    await writeConfig(`
agents:
  claude: "not an object"
`);
    const cfg = await loadConfig();
    expect(cfg.agents.claude).toEqual({ enabled: true, binary: 'claude' });
  });

  it('returns defaults for an empty YAML document', async () => {
    await writeConfig('');
    const cfg = await loadConfig();
    expect(cfg.agents.claude.enabled).toBe(true);
    expect(cfg.notifications.desktop).toBe(true);
  });
});
