export type AgentName = 'claude' | 'codex';

export type SessionStatus = 'idle' | 'working' | 'done' | 'error';

export type AgentEvent =
  | { type: 'output'; text: string }
  | { type: 'stderr'; text: string }
  | { type: 'session'; id: string }
  | { type: 'done'; exitCode: number };

export interface ExecOpts {
  prompt: string;
  agentSessionId?: string;
  cwd: string;
  signal: AbortSignal;
}

export interface Adapter {
  readonly name: AgentName;
  exec(opts: ExecOpts): AsyncIterable<AgentEvent>;
}

export interface Session {
  id: string;
  agent: AgentName;
  label: string;
  cwd: string;
  agentSessionId?: string;
  status: SessionStatus;
  createdAt: number;
  lastActivity: number;
  messageCount: number;
  errorMessage?: string;
}
