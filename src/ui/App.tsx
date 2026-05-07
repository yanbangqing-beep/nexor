import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useCallback, useState } from 'react';
import { createClaudeAdapter } from '../adapters/claude.js';
import type { AgentEvent } from '../types.js';

interface Slice1State {
  status: 'idle' | 'working' | 'done' | 'error';
  output: string;
  agentSessionId?: string;
}

const adapter = createClaudeAdapter();

export function App() {
  const { exit } = useApp();
  const [input, setInput] = useState('');
  const [state, setState] = useState<Slice1State>({ status: 'idle', output: '' });
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  useInput((_inputChar, key) => {
    if (key.ctrl && _inputChar === 'c') {
      abortController?.abort();
      exit();
    }
  });

  const onSubmit = useCallback(
    async (value: string) => {
      if (!value.trim() || state.status === 'working') return;
      setInput('');
      const ac = new AbortController();
      setAbortController(ac);
      setState((s) => ({
        ...s,
        status: 'working',
        output: `${s.output}\n> ${value}\n`,
      }));

      try {
        for await (const evt of adapter.exec({
          prompt: value,
          agentSessionId: state.agentSessionId,
          cwd: process.cwd(),
          signal: ac.signal,
        })) {
          applyEvent(evt, setState);
        }
      } catch (err) {
        setState((s) => ({
          ...s,
          status: 'error',
          output: `${s.output}\n[error] ${(err as Error).message}\n`,
        }));
      }
    },
    [state.status, state.agentSessionId],
  );

  return (
    <Box flexDirection="column" height="100%">
      <Box borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text bold>nexor</Text>
        <Text> · slice 1 · claude · </Text>
        <Text color={statusColor(state.status)}>{state.status}</Text>
        {state.agentSessionId && (
          <Text dimColor> · session {state.agentSessionId.slice(0, 8)}</Text>
        )}
      </Box>
      <Box flexGrow={1} flexDirection="column" paddingX={1}>
        <Text>{state.output || '(no output yet — type a prompt and press Enter)'}</Text>
      </Box>
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="green">{'> '}</Text>
        <TextInput value={input} onChange={setInput} onSubmit={onSubmit} />
      </Box>
    </Box>
  );
}

function applyEvent(evt: AgentEvent, setState: (fn: (s: Slice1State) => Slice1State) => void) {
  if (evt.type === 'output') {
    setState((s) => ({ ...s, output: `${s.output}${evt.text}\n` }));
  } else if (evt.type === 'session') {
    setState((s) => ({ ...s, agentSessionId: evt.id }));
  } else if (evt.type === 'done') {
    setState((s) => ({
      ...s,
      status: evt.exitCode === 0 ? 'done' : 'error',
      output: `${s.output}\n[exit ${evt.exitCode}]\n`,
    }));
  }
}

function statusColor(s: Slice1State['status']): string {
  switch (s) {
    case 'working':
      return 'yellow';
    case 'done':
      return 'green';
    case 'error':
      return 'red';
    default:
      return 'gray';
  }
}
