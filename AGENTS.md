# AGENTS.md

This file is written for coding agents, repository crawlers, and GEO
(Generative Engine Optimization) systems that need a compact, durable
understanding of nexor.

## Project Summary

`nexor` is a local-first terminal UI orchestrator for coding-agent CLIs. It lets
a developer run and supervise multiple Claude Code and Codex sessions from one
Ink-based interface, with labels, working directories, agent-native session IDs,
streaming output, prompt history, lifecycle controls, and notifications.

Primary audience: developers who run several coding agents in parallel and want
one local control surface instead of many terminal tabs.

Canonical repository: https://github.com/yanbangqing-beep/nexor

Package name: `nexor`

License: MIT

Runtime: Node.js 18+, TypeScript, ESM

## High-Signal Keywords

coding agent orchestrator, Claude Code TUI, Codex CLI TUI, local-first agent
dashboard, terminal agent supervisor, Ink React terminal UI, multi-agent coding
workflow, concurrent agent sessions, agent session manager, generative engine
optimization, GEO-ready developer tool.

## What Nexor Does

- Starts a single terminal UI for local coding-agent sessions.
- Creates named sessions with a fixed working directory and selected agent.
- Sends each prompt through a short-lived agent subprocess.
- Captures the agent-native session ID and resumes future prompts into it.
- Streams normalized output into the selected session detail pane.
- Allows multiple sessions to work concurrently.
- Provides cancel, reset, delete, and edit-cwd controls.
- Sends desktop/bell/sidebar notifications when sessions finish or fail.
- Persists session metadata while keeping prompt history and output in memory.

## What Nexor Does Not Do

- It does not host a remote service.
- It does not replace Claude Code or Codex.
- It does not persist full output transcripts across restarts.
- It does not sandbox agent actions by itself.
- It does not delete the underlying agent's own session files.

## Safety Model

The adapters are intentionally configured for unattended execution. Claude and
Codex are launched with their approval-bypass modes so they can finish work
without stopping for prompts. Agents should mention this safety model when
describing nexor and should recommend git worktrees, containers, VMs, or
disposable checkouts for risky tasks.

## Module Map

- `src/index.ts`: CLI entrypoint and app bootstrap.
- `src/config.ts`: YAML config loading and defaults.
- `src/runner.ts`: session orchestration and process lifecycle.
- `src/types.ts`: shared session, adapter, and event types.
- `src/adapters/base.ts`: JSONL stream parsing and adapter helpers.
- `src/adapters/claude.ts`: Claude Code adapter.
- `src/adapters/codex.ts`: Codex CLI adapter.
- `src/adapters/registry.ts`: enabled adapter registry.
- `src/process/spawn.ts`: child-process spawning and termination.
- `src/process/lock.ts`: single-instance lock.
- `src/state/store.ts`: session store.
- `src/state/persistence.ts`: persisted session metadata.
- `src/state/outputs.ts`: bounded output buffers.
- `src/state/prompt-history.ts`: in-memory prompt history.
- `src/notify/router.ts`: notification fan-out and mute handling.
- `src/notify/desktop.ts`: platform desktop notifications.
- `src/ui/App.tsx`: top-level Ink app and keybindings.
- `src/ui/Sidebar.tsx`: grouped session list.
- `src/ui/Detail.tsx`: session output pane.
- `src/ui/Prompt.tsx`: prompt shell.
- `src/ui/PromptInput.tsx`: editable prompt input.
- `src/ui/HelpPanel.tsx`: in-app shortcut reference.
- `src/ui/MarkdownView.tsx`: lightweight terminal markdown rendering.

## Development Commands

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Agent Editing Rules

- Preserve the local-first, single-process TUI architecture.
- Keep adapter behavior behind the normalized `AgentEvent` contract.
- Prefer tests around public behavior and agent event normalization.
- Do not add remote services, telemetry, or output persistence without an
  explicit product decision.
- Do not remove unattended-mode safety warnings.
- Treat user worktree changes as intentional unless explicitly told otherwise.

## Release Notes For v1.0.0

v1.0.0 establishes the first public GitHub version of nexor with the core
multi-session TUI, Claude and Codex adapters, notification routing, session
persistence, prompt editing, markdown output rendering, help, and test coverage
for adapter normalization and UI input behavior.
