# PRD — nexor v0.1.0

> A local-first TUI orchestrator for coding agent CLIs (Claude Code, Codex, etc.)
> Status: needs-triage
> License: MIT

---

## Problem Statement

I use multiple coding-agent CLIs every day — Claude Code, Codex, and my own home-grown `alice`. Each is its own interactive REPL in its own terminal window. This creates several pains:

- I can't see at a glance which agents are working, idle, done, or errored. State is hidden behind whichever terminal tab happens to be in front.
- When an agent finishes a long-running task, nothing tells me — I have to remember to switch back and check.
- I cannot run multiple tasks in parallel within a single agent. If I want Codex to work on two different projects simultaneously, I have to juggle two Codex shell sessions manually and remember which is which.
- Each agent has a different "session" model. I lose track of which conversation in which agent is about which task. Sessions accumulate as nameless UUIDs in agent-private storage.
- There is no single place that gives me a global view of "what is every coding agent on this machine currently doing."

I need an orchestration layer that is *agent-agnostic*, lets me name and label individual sessions by purpose, runs them concurrently, and notifies me when anything finishes.

## Solution

**nexor** is an open-source CLI tool (single TUI binary, distributed via npm) that becomes the single entry point for managing every coding-agent CLI session on the machine.

The user runs `nexor` once. It opens a master-detail TUI:

- A left sidebar lists all known sessions, grouped by agent (Claude / Codex / Alice), sorted with running sessions on top.
- A right detail pane shows the streaming output of whichever session is focused.
- A bottom prompt input sends new messages to the focused session.
- A status bar shows global summary and the last notification.

Each **session** is a first-class object with a human-readable label, a working directory locked at creation time, and the agent's own session ID (captured automatically after first prompt). Sessions persist across nexor restarts.

Under the hood, nexor never wraps the agent CLIs as long-lived REPLs. Instead, every prompt becomes one short-lived `agent --resume <id> -p "<prompt>"` (or equivalent) subprocess. State lives on disk in each agent's own session files; nexor just remembers which session ID maps to which labeled session, and dispatches.

When any session transitions from `working` to `done` or `error`, nexor fires a desktop notification, rings the terminal bell, and flashes the corresponding sidebar row. Notifications can be globally muted with one keystroke.

The user can run multiple sessions of the same agent concurrently (e.g., two Codex sessions simultaneously editing two different repos). Each session keeps its own working directory, agent session ID, and output buffer.

## User Stories

1. As a developer, I want to launch a single TUI from any terminal, so that I have one entry point for every coding agent on my machine.
2. As a developer, I want nexor to refuse to start a second instance, so that I never end up with two TUIs writing to the same session store and corrupting state.
3. As a developer, I want to see all sessions across all agents in one sidebar, so that I have a global view of what every agent is doing.
4. As a developer, I want sessions grouped by agent in the sidebar, so that I can quickly locate the agent I'm thinking of.
5. As a developer, I want running sessions to sort to the top of each group, so that the most live work is always under my eye.
6. As a developer, I want to create a new session by pressing `n`, so that starting work is immediate and keyboard-driven.
7. As a developer, I want to give every new session a required human-readable label, so that I can tell at a glance what each session is about and never end up with five "Untitled" sessions.
8. As a developer, I want to lock a working directory to each session at creation time, so that the session's purpose stays bound to a specific project and I don't accidentally cross-contaminate.
9. As a developer, I want to type a prompt in the bottom input and press Enter to send it to the focused session, so that the daily-driver flow is fast.
10. As a developer, I want Shift+Enter to insert a newline in the prompt input, so that I can compose multi-paragraph prompts (with embedded code blocks) the same way I do in Slack or ChatGPT.
11. As a developer, I want to recall my previous prompts in this session with the up/down arrow keys, so that I don't have to retype similar instructions.
12. As a developer, I want the focused session's streaming output to appear live in the detail pane, so that I can watch agents think instead of staring at a frozen pane.
13. As a developer, I want to navigate between sessions in the sidebar with `j`/`k` or arrow keys, so that I can browse agent state without leaving the keyboard.
14. As a developer, I want to switch focus between the sidebar and the prompt input with Tab, so that I can move between browsing and typing without a mouse.
15. As a developer, I want to run multiple sessions of the same agent in parallel, so that I can have Codex working on two different repos simultaneously.
16. As a developer, I want each session to spawn its own short-lived agent subprocess, so that no agent process can deadlock the others and concurrency is structurally safe.
17. As a developer, I want nexor to capture and store each agent's own session ID after the first prompt, so that the next prompt resumes the same conversation rather than starting from zero.
18. As a developer, I want my session list to persist to disk across nexor restarts, so that I don't lose track of in-flight work just because I quit the TUI.
19. As a developer, I want the agent session conversation history to live in the agent's own session files (not duplicated in nexor), so that I can also resume those sessions directly from the agent CLI if I ever want to.
20. As a developer, I want a desktop notification when any session transitions to `done` or `error`, so that I can step away from the terminal during long runs and come back exactly when something needs me.
21. As a developer, I want the terminal bell to ring on the same transitions, so that I get an audible cue even when the OS notification is missed.
22. As a developer, I want the corresponding sidebar row to flash green on success or red on failure, so that I can locate the just-finished session at a glance when I look back at the TUI.
23. As a developer, I want to globally mute desktop notifications and the bell with the `m` key, so that I can run the TUI in a meeting without disturbing anyone.
24. As a developer, I want to cancel a running task with `c`, so that I can stop a runaway agent without losing the session itself — I should be able to send a follow-up prompt afterwards.
25. As a developer, I want to reset a session with `r` (kill the process and forget the agent's session ID, but keep the label and cwd), so that I can wipe the conversation context without losing the slot.
26. As a developer, I want to delete a session entirely with `d` (kill the process and remove it from nexor), so that I can clean up sessions I no longer care about.
27. As a developer, I want nexor to never delete the agent's own session files when I delete a session, so that I can recover an accidentally deleted session by directly invoking the agent CLI.
28. As a developer, I want subprocess termination to use SIGTERM with a 3-second grace period before SIGKILL, so that agents have a chance to flush logs and close LLM connections cleanly.
29. As a developer, I want to quit nexor with `q`, with a confirmation prompt if any session is currently running, so that I don't accidentally kill in-flight work.
30. As a developer, I want each session's output buffer capped at 5 MB with FIFO eviction and a "[earlier output truncated]" indicator, so that long-running tasks don't blow up nexor's memory.
31. As a developer, I want output buffers and prompt history to be in-memory only (not persisted across restarts), so that startup is fast and the disk doesn't fill with verbose stdout.
32. As a developer, I want all agents to run with their respective "skip approval" flags by default (claude `--dangerously-skip-permissions`, codex `--dangerously-bypass-approvals-and-sandbox`), so that headless mode actually finishes tasks instead of blocking on permission prompts.
33. As a developer, I want the README to clearly warn that nexor runs agents in unattended mode and recommend isolated environments (git worktrees, containers), so that I can make an informed safety call.
34. As a developer, I want to configure each agent's binary path in a YAML config file, so that I can use non-default installations without recompiling nexor.
35. As a developer, I want a status bar showing global counts (running / idle), the most recent notification, and the mute state, so that I always have ambient awareness without opening anything.
36. As a developer, I want errors (non-zero exit codes) to flip the session into an `error` state with the stderr output visible at the bottom of the detail pane, so that I can diagnose failures without leaving the TUI.
37. As a developer, I want sessions whose agent binaries are missing or fail to start to surface a clear error message in nexor instead of crashing the TUI, so that I can recover gracefully.
38. As a developer, I want nexor to refuse new prompts on a session whose status is currently `working`, with a clear "session busy" message, so that I cannot accidentally pile up commands and create ambiguous state.
39. As a developer, I want the new-session modal to default the cwd field to nexor's startup directory, so that the common case is one keystroke.
40. As a developer, I want the agent dropdown in the new-session modal to only list agents enabled in config, so that I never accidentally create a session against an agent I don't have installed.
41. As a developer, I want nexor to release its single-instance lock file cleanly on quit (and on common termination signals like SIGINT), so that the next launch doesn't think nexor is still running.

## Implementation Decisions

### Architecture
- **Process model**: Headless-with-session. Every prompt spawns a fresh agent subprocess that resumes the agent's persisted session, prints output to stdout, and exits. nexor never holds a long-lived agent process and never multiplexes PTYs.
- **Concurrency**: Multiple sessions can be in `working` state simultaneously, including multiple sessions of the same agent. Each session corresponds to one short-lived child process.
- **Scope**: Single global instance, machine-wide. No per-project segregation — sessions are first-class and carry their own working directory.
- **Single-instance enforcement**: PID-bearing lock file. Second launch reads the lock, verifies the PID is alive, errors out if so.
- **Routing**: Strictly one prompt → one focused session. No broadcast, no fan-out.

### Modules

- **Adapter** (deep): Hides each agent CLI's quirks behind a uniform interface that takes a prompt + optional resume id + cwd + abort signal and returns an async iterable of three event types (`output`, `session`, `done`). Two concrete adapters in v0.1: Claude (uses stream-json output) and Codex (uses `--json` flag and the `exec resume` subcommand). Each adapter also implements a `normalize` step that maps its agent's native event schema onto nexor's event types.
- **JSONL Parser** (deep, shared by adapters): Consumes a readable byte stream of newline-delimited JSON, yielding parsed objects, with non-JSON lines surfaced as raw-text fallback events.
- **Session Store** (deep): In-memory authoritative state of all sessions; mutating APIs for create / update status / append output / set agent session id / delete; persistence layer that debounces writes to a JSON file at 200 ms; rehydration on startup.
- **Process Manager** (deep): Spawns child processes with cwd, tracks PIDs, exposes cancellation via AbortSignal that escalates SIGTERM → SIGKILL after a 3-second grace period; enforces the one-running-task-per-session rule.
- **Output Buffer** (deep): Per-session ring buffer with a 5 MB byte cap; FIFO drop on overflow; exposes a "truncated above" flag.
- **Prompt History** (deep): Per-session ring of the last 50 prompts, in-memory only, with up/down navigation cursor.
- **Notification Router** (deep): Subscribes to status transitions; fans out to desktop notification, terminal bell, and a UI-flash event channel; respects a global mute flag.
- **Lock Manager** (shallow): Reads, writes, and validates the single-instance lock file with PID liveness check; cleans up on shutdown.
- **Config Loader** (shallow): Reads a YAML config file; validates against a schema; provides defaults; controls which adapters are enabled and the binary path each adapter spawns.
- **TUI Components** (shallow, view layer): Sidebar (grouped session list), Detail (streaming output viewer), Prompt (multi-line input with history), StatusBar, NewSessionModal, top-level App that wires global keybindings and modal flow.
- **Orchestrator** (glue layer): Wires user input → process manager → adapter → session store mutations → notification router. Also owns startup/shutdown lifecycle.

### Adapter contract

The adapter interface returns an async iterable of three event types only. `output` carries an arbitrary text fragment to append to the session's output buffer. `session` carries the agent-native session ID that should be persisted on the session record (emitted at most once per exec, on the first prompt). `done` carries the subprocess exit code. Errors during streaming are thrown from the iterable and caught by the orchestrator, which flips the session into `error` state.

### Session lifecycle

A session is created via the new-session modal with required fields `agent`, `label`, and `cwd`. It enters `idle` with no agent session ID. The first prompt to that session spawns a subprocess without a resume flag; the adapter emits a `session` event when it discovers the agent's session ID and a `done` event when the subprocess exits. nexor stores the agent session ID on the session record and uses it for every subsequent prompt's resume flag. Cancel keeps the agent session ID. Reset wipes it and the next prompt starts a fresh agent session. Delete removes the entire session record from nexor but never touches the agent's own session files.

### Termination semantics

Three keys, three meanings, one common subprocess-kill path:
- **`c` Cancel**: kill subprocess, status → `idle`, agent session ID retained, conversation can be resumed.
- **`r` Reset**: kill subprocess, agent session ID cleared, label and cwd retained, next prompt starts a new agent-side session.
- **`d` Delete**: kill subprocess, session record removed from sidebar entirely; agent's own session files left intact.

All three paths route through Process Manager's cancellation, which uses SIGTERM with a 3-second grace window before SIGKILL.

### Persistence

Two on-disk locations. Configuration lives at the XDG config directory under nexor's namespace; sessions and the lock file live at the XDG data directory under nexor's namespace. Sessions are written as a single JSON document, debounced at 200 ms after the last mutation. Output buffers and prompt history are explicitly *not* persisted.

### Safety defaults

All adapters pass their respective "skip permissions / bypass approvals" flags by default. The README and the first-run experience must clearly communicate that this puts the user in unattended mode. A worktree- or container-based isolation pattern is the recommended user-facing safety story; nexor itself does not enforce it.

### Configuration surface (v0.1)

A YAML file at the XDG config location declares which adapters are enabled and overrides for each adapter's binary path. Notification booleans (desktop, bell) are also configurable. Anything beyond that — themes, keybindings, custom adapters, hooks — is out of scope for v0.1.

### Tech stack

TypeScript with strict mode on Node 18+. Ink for the TUI (with `ink-text-input`, `ink-spinner`). Zustand for state. `node-notifier` for desktop notifications. tsup for build, vitest for tests, Biome for lint+format. Distribution as a single npm package called `nexor`.

## Testing Decisions

### Principles

Test external behavior, not internal mechanics. A good test feeds public inputs to a module's public interface and asserts the public outputs. It does not poke at private state, mock framework internals, or rely on the module being structured a particular way. Refactoring the implementation should not require rewriting tests.

For modules that interact with side-effectful systems (subprocess, filesystem, OS notifications), inject the side-effecting boundary as a dependency so tests can substitute a fake. For modules that are pure data structures (Output Buffer, Prompt History, Session Store mutations), tests are pure functions over inputs and assertions over outputs.

There is no prior-art test suite in the repo (greenfield project). Use the modules listed below as templates for what good tests look like, and document the test patterns in `tests/README.md` as the suite grows.

### Modules with unit tests in v0.1

- **Adapter + JSONL Parser**: highest bug density, highest test value. For each adapter, drive synthesized JSONL byte streams through the parser + normalize pipeline and assert that the right `AgentEvent` sequence comes out, including the case where session ID arrives mid-stream, the case where stdout closes mid-line, the case where non-JSON text is interleaved, the case where the subprocess exits non-zero, and the case where AbortSignal fires while the iterable is consuming.
- **Session Store**: state mutations + persistence round-trip. Assert that creating a session and then rehydrating from the persisted JSON yields the same record. Assert that a `working` session cannot accept a second concurrent prompt. Assert that delete actually drops the record. Assert that the 200 ms debounce coalesces bursts.
- **Process Manager**: cancellation behavior. Assert that SIGTERM is sent first, that SIGKILL is sent after the 3-second grace period if the child has not exited, and that AbortSignal-driven cancellation is correctly propagated. Use a stub subprocess (a long-running `sleep` or a node helper) rather than mocking `child_process` directly.
- **Output Buffer + Prompt History**: pure data-structure tests. Output buffer: append until cap, verify FIFO eviction and the truncation flag. Prompt history: navigate cursor up and down, verify rollover at limits, verify that submitting a new prompt resets the cursor to "tip."

### Modules deferred from unit tests

TUI Components (visual regressions are better caught by manual review during M3-M4), Lock Manager (filesystem dependency is high-friction to fake; integration test if at all), Config Loader (shallow YAML parse, low value), Notification Router (mostly fan-out routing; can be smoke-tested manually). Orchestrator is the integration layer — covered by end-to-end smoke tests during the M2 milestone using a real Claude binary, not unit-tested in isolation.

## Out of Scope

The following are explicitly deferred to v0.2 or later and must not be designed into v0.1:

- **alice adapter**. v0.1 ships with Claude and Codex adapters only. The third adapter is added in v0.2 once `alice` itself supports the `exec --json --session <id> "<prompt>"` headless protocol.
- **Stream-json rich rendering**. Tool-use blocks, thinking blocks, cost summaries — all rendered as raw text in v0.1. Pretty rendering is v0.2+.
- **Output persistence and scrollback restoration**. v0.1 detail pane starts empty after restart, even though session IDs are preserved.
- **Search and filter over the session list**. v0.1 sidebar is a flat sorted list with no filter input.
- **Themes and color customization**. v0.1 ships with a single hardcoded color scheme.
- **Generic shell adapter** that lets arbitrary CLIs be plugged in via config. v0.1 has three hardcoded adapter modules. A "bring your own adapter" extensibility story is v0.2+.
- **Windows support**. v0.1 ships for macOS and Linux only. Windows-specific notification stack and process semantics are deferred.
- **Editor-based prompt composition** (`e` key launching `$EDITOR` for very long prompts). v0.1 supports multi-line via Shift+Enter only.
- **External CLI subcommands** (`nexor send`, `nexor list`, `nexor kill`). v0.1 is TUI-only.
- **Notification click → focus session**. v0.1 notifications are fire-and-forget.
- **Configuration hot reload**. Config is read once at startup.
- **Multiple-window or daemon-plus-thin-client architecture**. v0.1 is a single self-contained TUI process.
- **A "compare answers" or broadcast workflow**. The product is positioned as a parallel-multitask workshop, not an A/B testing harness.
- **Per-agent or per-event notification configuration**. v0.1 has one global mute toggle and no finer granularity.

## Further Notes

### Day-0 verification checklist (before writing implementation code)

The Codex CLI evolves rapidly and the Claude CLI's stream-json schema has version variance. Before locking the adapter normalize functions, the developer must capture the actual event payload schemas from both binaries on the development machine. Specifically:
- Run `claude -p "say hi" --output-format stream-json --verbose` and record which event types carry `session_id`, what shape `assistant` / `tool_use` / `result` events take, and where text content lives.
- Run `codex exec --json "say hi"` and record the same.
- Re-verify both before each release if either CLI has been updated since.

### Milestone structure

The implementation is sliced into four milestones across roughly two to three weeks of full-time work:

- **M1 — Skeleton (2–3 days)**: repo scaffolding, empty Ink TUI rendering a placeholder layout, sessions.json read/write round-trip, single-instance lock.
- **M2 — Single adapter end-to-end (3–4 days)**: Claude adapter spawning a real subprocess, JSONL parser yielding events, output streaming live to a hardcoded detail pane, session ID captured and stored.
- **M3 — Full interactive surface (5–7 days)**: Codex adapter, new-session modal, sidebar with grouping and sorting, all three termination keys, prompt history, status bar.
- **M4 — Polish and release (3–5 days)**: notification system wired, 5 MB output buffer enforcement, error states surfaced, README and safety warnings, GitHub Actions CI, npm publish v0.1.0.

### Distribution

Single npm package `nexor`. Installed via `npm i -g nexor` or `npx nexor` for trial. Published from GitHub Actions on tag push. License MIT. Public repository on GitHub from day one.

### Out-of-band coordination

The user's home-grown `alice` CLI must independently implement an `exec --json --session <id> "<prompt>"` mode that emits the same JSONL event vocabulary nexor consumes (events with at least `output`, `session`, and `done` semantics, one per stdout line). This is parallel work that does not block v0.1 since alice is deferred to v0.2.
