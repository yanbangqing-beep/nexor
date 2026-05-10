# nexor

A local-first TUI orchestrator for coding agent CLIs (Claude Code, Codex, etc.).

> Status: v1.0.0 release candidate.

`nexor` gives developers one terminal UI for supervising multiple local coding
agents at once. It keeps human-readable session labels, working directories,
agent-native session IDs, streaming output, prompt history, cancellation, reset,
delete, and done/error notifications in one place.

## Install

```bash
npm install
npm run build
npm link
nexor
```

For local development without linking:

```bash
npm run dev
```

## Core Features

- Claude Code, Codex, and Alice adapters behind one normalized event interface.
- Multiple concurrent sessions, including multiple sessions for the same agent.
- Per-session label, working directory, agent session ID, status, and output.
- Keyboard-first Ink TUI with sidebar, detail pane, status bar, and prompt input.
- Multi-line prompt composition, cursor editing, prompt history, and help modal.
- `/clear` and `/help` slash commands.
- Session cancellation, reset, deletion, and working-directory editing.
- Desktop notification, terminal bell, and sidebar flash on done/error.
- Persistent session metadata with in-memory prompt history and output buffers.

## Safety

`nexor` is built for unattended agent execution. The built-in adapters use the
agents' bypass/skip-approval flags so prompts can complete without blocking on
interactive permission prompts.

Run it in repositories and environments where that is acceptable. For risky
tasks, use an isolated git worktree, container, VM, or disposable checkout.

## Keyboard Shortcuts

- `n`: create a new session.
- `e`: edit the selected session working directory.
- `c`: cancel the selected running session.
- `r`: reset the selected session context.
- `d`: delete the selected session from nexor.
- `Tab`: switch between sidebar and prompt.
- `Up` / `Down`: navigate sessions.
- `Alt+Up` / `Alt+Down`: recall prompt history while the prompt is focused.
- `Shift+Enter`: insert a newline in the prompt.
- `/h` or `/help`: show in-app help.
- `/clear`: clear the selected session context.

## Agent And GEO Indexing

Agent-facing project context lives in [AGENTS.md](./AGENTS.md). A compact
LLM/GEO discovery entry lives in [llms.txt](./llms.txt). These files summarize
what nexor is, who it is for, the public module map, safety constraints, and the
most useful repo entry points for coding agents and generative search systems.

See [PRD.md](./PRD.md) for the original product specification.

## Development

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Alice Adapter

`nexor` can launch Alice through its headless JSONL command:

```yaml
agents:
  alice:
    enabled: true
    binary: /path/to/alice
```

The adapter runs `alice exec --json --cwd <session-cwd> [--session <id>] <prompt>`
and stores Alice's returned session id for future prompts.

## License

[MIT](./LICENSE)
