# SDK

`@earendil-works/pi-coding-agent` embeds Pi in a Node.js or Bun process. It provides direct TypeScript access to the agent, sessions, tools, models, and resources used by the command-line application.

Use the SDK for in-process TypeScript integration. For a language-independent or isolated subprocess, see [CLI Integration](cli-integration.md).

```typescript
import { createAgentSession } from "@earendil-works/pi-coding-agent";

const { session } = await createAgentSession();

try {
  await session.prompt("What files are in the current directory?");
  console.log(session.getLastAssistantText());
} finally {
  session.dispose();
}
```

This uses the working directory, discovered resources, stored settings, and configured credentials. `prompt()` resolves when the run finishes.

The [complete minimal example](../examples/sdk/01-minimal.ts) also streams text events. All [SDK examples](../examples/sdk/) are typechecked with the repository.

<a id="session-management"></a>

## Session lifecycle

`createAgentSession()` creates an `AgentSession`. The session owns one conversation, its model and tools, queued messages, compaction state, and extension runtime.

Read current state through `session.messages`, `session.model`, `session.thinkingLevel`, `session.systemPrompt`, and `session.getActiveToolNames()`.

`session.systemPrompt` is read-only and returns the current effective system prompt, including changes that have not yet been sent to the model. Tool changes are declared to the model before the next request.

<a id="sessionmanager-api"></a>

### Session storage

Sessions are persistent by default. `SessionManager` owns the persisted or in-memory entry tree and tracks its active leaf. Branching changes that leaf without deleting abandoned branches. When Pi reconstructs model context, the manager selects the active branch and applies compaction.

`SessionManager` is authoritative for finalized model context. Restore external history by constructing the session with a manager containing those entries. Assigning `session.agent.state.messages` does not replace persisted context.

Use an in-memory manager when the host does not want session files:

```typescript
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
});
```

See the checked [sessions example](../examples/sdk/11-sessions.ts) for creating, opening, continuing, listing, and forking sessions. [Session File Format](session-format.md) defines the persisted JSONL contract, and [Message Types](message-types.md) defines transcript values. For exact methods and signatures, use the exported TypeScript declarations or [`session-manager.ts`](../src/core/session-manager.ts).

`cwd` selects the workspace used for project resource discovery, context files, session grouping, and built-in tool paths. Pass it explicitly when the target differs from `process.cwd()`.

`session.dispose()` aborts active work, invalidates extension contexts, disconnects from the agent, and removes event listeners. Call it when the session is no longer needed.

`AgentSessionRuntime` adds `newSession()`, `switchSession()`, `fork()`, and `importFromJsonl()`. Each operation replaces the active `AgentSession` and recreates services for the target working directory.

After a runtime replacement, subscriptions belong to the old `AgentSession` and must be rebound. See the [session runtime example](../examples/sdk/13-session-runtime.ts).

## Prompting

`prompt()` handles extension commands and expands file-based prompt templates before ordinary user messages enter the agent. For an accepted agent run, it resolves after the run finishes, including automatic retries.

A prompt sent while the session is already streaming must specify whether it should steer the current run or follow it. Calling `prompt()` without that choice rejects rather than guessing.

A steering message enters after the current assistant turn and its tool calls. A follow-up enters after the current run finishes its pending work. `steer()` and `followUp()` expose those behaviors directly and return `"queued"` if the input was queued (including after an extension transformed it), or `"handled"` if an extension consumed it.

`abort()` stops the active operation and waits for the session to become idle. `waitForIdle()` waits without aborting it.

## Native scheduled custom turns

`session.scheduledExecution` is capability version `1`. Extensions see the same optional capability through `ctx.scheduledExecution`; an older host may omit it. A resilient scheduler must refuse a missing/different version before it spends an attempt or sends inference. `AgentSession.scheduledExecutionVersion` is the additive static SDK declaration for a pre-construction check: it lets a model-session consumer reject an older SDK before admission, without constructing a second writer of a shared persistent transcript. It is metadata, not an execution handle; verify the actual instance capability again before inference. This API adds no scheduler, runner or authorization.

```typescript
const capability = session.scheduledExecution;
if (capability?.version !== 1) throw new Error("Unsupported native scheduled execution");
const accepted = capability.start({
  binding: { jobId: "job", attemptId: "attempt", ownerSessionId: session.sessionId, ownerEpoch: 1, revision: 1 },
  policy: { softDeadlineMs: 25 * 60_000, hardDeadlineMs: 45 * 60_000 },
  content: "Advance this already-authorized occurrence without repeating completed work.",
});
if (!accepted.accepted) throw new Error(accepted.reason);
const handle = accepted.handle;
// A request is not an exit acknowledgement. The exact handle remains owned until settled.
handle.requestDrain("slice_finished");
const receipt = await handle.settled;
console.log(receipt.execution, receipt.checkpointEntryId); // Business outcome is still unverified.
```

The additive `unattendedInputGuardVersion === 1` declares native preflight protection for `ask_user_question`: direct, nested and late-registered calls are blocked before any extension tool-call handler or UI runs, completed results are checkpointed, and the exact run drains with `waitingReason: user_input_required` without an extra summary request. Ordinary user questions are unchanged. Consumers may detach only their own legacy tool hook after verifying this actual capability and the exact active run binding; absent support must retain the legacy guard. Arbitrary third-party lifecycle hooks are still effect-unknown.

`start()` accepts only an idle session with no pending input. It persists the accepted job/attempt/session/epoch/revision and returns an opaque run handle; those values do not come from model message details. Busy/disposed refusals start no inference. The accepted policy is copied, never temporarily installed in `SettingsManager`. The scheduler remains responsible for its store-wide single-flight admission and finite lifetime/daily/expiry bounds.

The scheduled profile permits at most three additional retries per response, stops after three equivalent failed responses including the first, and defaults to five minutes of cumulative failed-call/retry-wait recovery time. Successful reasoning does not spend or replenish recovery time. Native classification, fingerprinting and stepped backoff are reused; provider retries are disabled for the accepted run. The SDK also cancels prior cache warming and does not register extra warming requests for this finite run; warming configuration and subsequent ordinary prompts are unchanged. Actual exposed Retry-After headers are respected or deferred, never capped into an early retry. Soft/hard elapsed deadlines use monotonic time and are independent of cadence, provider acknowledgement/idle timeouts and tool-specific timeouts. They cannot exceed one day; the soft budget must precede the explicit hard budget. No global retry/model/provider configuration is changed.

`handle.snapshot()` is metadata only. `request-started` means the runtime called its stream adapter, not that a network request reached the provider; `response-received` requires actual exposed response headers. Missing transport stages, time to first byte and business progress remain unknown. Counts/heartbeats do not prove business output.

`requestDrain()` stops new direct and nested tools at the next guard and closes at a safe native boundary without requesting final prose. `handle.checkpoint()` persists real completed result-entry references at any native/local boundary, including while draining; optional artifact/hash/effect/next-action declarations remain unverified. Automatic tool-batch checkpoints and the final checkpoint survive a failed final summary without rerunning tools. At most 256 recent result references are projected; the completed count and raw transcript retain the earlier history. Neither declarations nor an error-free tool imply external effect completion. The runtime only treats the shipped built-in `read`, `grep`, `find` and `ls` implementations as read-only when their original executable identity and builtin source are still intact and no `tool_call` or `tool_result` lifecycle handler is attached. A custom override, extension tool with the same name, codemode/bash wrapper, lifecycle hook, user annotation or model claim remains effect-unknown; a future consumer must reconcile that checkpoint before replaying conflicting work.

`requestCancel()` signals only this exact native run. Non-cooperative tools and explicitly owned operations retain the slot. To bind a child the run actually owns, call `handle.own({ id, closed, cancel? })` with its real closure promise; detached notifications do not qualify. `settled` resolves only after the native loop and those handles end and a checkpoint/receipt is persisted. A checkpoint/receipt persistence failure leaves attention-required ownership rather than releasing a replacement. Old handles cannot cancel a later user run. Explicit user input queued while a scheduled run is active starts a separate ordinary turn after exact closure; user extension commands and the legacy `ctx.abort(): void` contract are retained.

Native metadata uses append-only `pi.scheduled-start.v1`, `pi.scheduled-checkpoint.v1` and `pi.scheduled-receipt.v1` custom entries. A file-backed session explicitly materializes its buffered entries before native metadata is accepted, even if no user/assistant reply exists yet. The additive synchronous `SessionManager.flush()` performs that opt-in materialization; ordinary interaction remains lazy and `SessionManager.inMemory()` intentionally remains memory-only, not crash recovery storage. These entries are not model context. Runtime completion/cancellation does not establish business success, effect rollback, a safe replay or renewed authority. A scheduler must reconcile uncertain effects before resuming them. This native slice does not itself migrate or re-enable any historical job. The cross-repository owner acceptance is [Schedule resilient-serial-scheduling](https://github.com/chenhaoxiang/pi-schedule-prompt/tree/feat/resilient-serial-scheduling-20261103/openspec/changes/resilient-serial-scheduling).

## Subscribing to events

Subscribe before prompting when the host needs streamed output:

```typescript
const unsubscribe = session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

try {
  await session.prompt("Explain this repository");
} finally {
  unsubscribe();
}
```

Session events report message updates, tool execution, queues, compaction, retries, and run lifecycle changes.

`message_end` contains the authoritative completed message. `agent_end` marks the end of one low-level agent run, but automatic recovery or queued work can still follow.

Use `agent_settled` when the host needs to know that Pi will not continue automatically.

## Configuring a session

Without overrides, the factory creates a `ModelRuntime`, file-backed `SettingsManager`, persistent `SessionManager`, `DefaultResourceLoader`, and the configured default tools.

Each boundary can be supplied explicitly:

- `modelRuntime`, `model`, `thinkingLevel`, and `scopedModels` control model access and selection.
- `settingsManager` supplies merged settings or an in-memory configuration.
- `sessionManager` supplies persistent or in-memory conversation history.
- `resourceLoader` supplies extensions, skills, prompt templates, themes, and context files.
- `tools`, `noTools`, `excludeTools`, and `customTools` control the active tool set.

Use `DefaultResourceLoader` when you want standard discovery with selected overrides. Supply a custom `ResourceLoader` when the host owns resource storage and discovery completely.

<a id="inlineextension"></a>

Inline extension factories can be supplied through `DefaultResourceLoader`. Give one an `InlineExtension` name only when it needs a stable name in diagnostics and startup output. A named inline extension with `replaceable: true` is left out when another extension registers a tool, command, or flag with a name it registers during loading, instead of both loading with a conflict. The CLI's built-in codemode, tool search, and MCP extensions are replaceable. A named entry with `builtin: true` is not an inline extension: it supplies the code of the `builtin:<name>` extension, which loads like a configured extension file. It loads by default, is listed in `pi config`, and is disabled by `-builtin:<name>` in the `extensions` setting or by `noExtensions`; `additionalExtensionPaths: ["builtin:<name>"]` loads it explicitly. It loads after project trust is resolved, so it cannot handle `project_trust`. The CLI's built-in extensions use it.

<a id="codemode-mcp"></a>

The CLI loads `codemode`, `tool_search`, and MCP as built-in extensions. SDK sessions do not; add `createCodemodeExtension()`, `createToolSearchExtension()`, and `createMcpExtension()` to the `extensionFactories` of `DefaultResourceLoader`. `codemode` and `tool_search` are registered inactive: enable them through the `defaultTools` setting (`["+codemode", "+tool_search"]` keeps the other default tools), or let the MCP extension activate them: `codemode` for servers with `codemode` exposure, `tool_search` for servers with `deferred` exposure. The MCP extension connects its servers on `session_start`, so call `session.bindExtensions()`. See [Codemode and MCP](../examples/sdk/14-codemode-mcp.ts).

See the focused examples for [models](../examples/sdk/02-custom-model.ts), [tools](../examples/sdk/05-tools.ts), [extensions](../examples/sdk/06-extensions.ts), and [full control](../examples/sdk/12-full-control.ts).

## Examples

| Example | Purpose |
|---|---|
| [Minimal](../examples/sdk/01-minimal.ts) | Create, prompt, observe, and dispose a session |
| [Custom model](../examples/sdk/02-custom-model.ts) | Select a model and thinking level |
| [System prompt](../examples/sdk/03-custom-prompt.ts) | Replace or append to the system prompt |
| [Skills](../examples/sdk/04-skills.ts) | Discover, filter, and add skills |
| [Tools](../examples/sdk/05-tools.ts) | Select built-in tools and their working directory |
| [Extensions](../examples/sdk/06-extensions.ts) | Load file-based and inline extensions |
| [Context files](../examples/sdk/07-context-files.ts) | Add or replace project instructions |
| [Prompt templates](../examples/sdk/08-prompt-templates.ts) | Add file-style prompt templates |
| [Credentials](../examples/sdk/09-api-keys-and-oauth.ts) | Configure credential and model storage |
| [Settings](../examples/sdk/10-settings.ts) | Supply file-backed or in-memory settings |
| [Sessions](../examples/sdk/11-sessions.ts) | Control session persistence and restoration |
| [Full control](../examples/sdk/12-full-control.ts) | Replace default discovery and state services |
| [Session runtime](../examples/sdk/13-session-runtime.ts) | Replace the active session safely |
| [Codemode and MCP](../examples/sdk/14-codemode-mcp.ts) | Add the `codemode`, `tool_search`, and MCP extensions |

<a id="exports"></a>

## Resources

- [Choose a Model](models.md) covers model selection and compatible endpoints; [Providers](providers.md) covers credentials and provider-specific setup.
- [Configuration](configuration.md) explains normal discovery and settings; [Settings](settings.md) lists every setting.
- [Sessions and Context](sessions.md) explains session behavior; [Session Format](session-format.md) defines persisted entries; [Message Types](message-types.md) defines shared transcript values.
- [Extensions](extensions.md), [Skills](skills.md), and [Prompt Templates](prompt-templates.md) document resources supplied through a `ResourceLoader`.
- [CLI Integration](cli-integration.md) covers print, JSON, and RPC alternatives to an in-process SDK integration.
