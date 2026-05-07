import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useState } from 'react';
import type { AdapterRegistry } from '../adapters/registry.js';
import type { AgentName } from '../types.js';

export interface NewSessionInput {
  agent: AgentName;
  label: string;
  cwd: string;
}

export interface NewSessionModalProps {
  defaultCwd: string;
  registry: AdapterRegistry;
  onSubmit: (input: NewSessionInput) => void;
  onCancel: () => void;
}

type Step = 'agent' | 'label' | 'cwd';

export function NewSessionModal({
  defaultCwd,
  registry,
  onSubmit,
  onCancel,
}: NewSessionModalProps) {
  const enabledAgents = (Object.keys(registry) as AgentName[]).filter((a) => registry[a]);
  const [step, setStep] = useState<Step>('agent');
  const [agentIdx, setAgentIdx] = useState(0);
  const [label, setLabel] = useState('');
  const [cwd, setCwd] = useState(defaultCwd);

  useInput((char, key) => {
    if (key.escape) {
      onCancel();
      return;
    }
    if (step === 'agent') {
      if (key.upArrow || char === 'k') {
        setAgentIdx((i) => Math.max(0, i - 1));
      } else if (key.downArrow || char === 'j') {
        setAgentIdx((i) => Math.min(enabledAgents.length - 1, i + 1));
      } else if (key.return) {
        setStep('label');
      }
    }
  });

  const onLabelSubmit = (v: string) => {
    if (!v.trim()) return;
    setStep('cwd');
  };

  const onCwdSubmit = (v: string) => {
    onSubmit({ agent: enabledAgents[agentIdx], label: label.trim(), cwd: v.trim() || defaultCwd });
  };

  return (
    <Box
      borderStyle="double"
      borderColor="yellow"
      flexDirection="column"
      paddingX={2}
      paddingY={1}
      width={60}
    >
      <Text bold>new session</Text>
      <Box marginTop={1} flexDirection="column">
        <Text color={step === 'agent' ? 'green' : undefined}>
          agent: {step === 'agent' ? '(↑↓ to choose, Enter to confirm)' : enabledAgents[agentIdx]}
        </Text>
        {step === 'agent' &&
          enabledAgents.map((a, i) => (
            <Text key={a} color={i === agentIdx ? 'green' : undefined}>
              {i === agentIdx ? '  ▸ ' : '    '}
              {a}
            </Text>
          ))}
      </Box>

      <Box marginTop={1}>
        {step === 'label' ? (
          <Box>
            <Text color="green">label: </Text>
            <TextInput value={label} onChange={setLabel} onSubmit={onLabelSubmit} />
          </Box>
        ) : (
          <Text dimColor={step === 'agent'}>label: {label || '(required)'}</Text>
        )}
      </Box>

      <Box marginTop={1}>
        {step === 'cwd' ? (
          <Box>
            <Text color="green">cwd: </Text>
            <TextInput value={cwd} onChange={setCwd} onSubmit={onCwdSubmit} />
          </Box>
        ) : (
          <Text dimColor>cwd: {cwd}</Text>
        )}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>esc to cancel</Text>
      </Box>
    </Box>
  );
}
