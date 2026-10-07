import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Agent, type AgentTool } from "@earendil-works/pi-agent-core";
import { type AssistantMessage, type AssistantMessageEvent, EventStream, getModel } from "@earendil-works/pi-ai/compat";
import { Type } from "typebox";
import { afterEach, describe, expect, it } from "vitest";
import { AgentSession } from "../src/core/agent-session.ts";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";
import { createModelRegistry, getModelRuntime } from "./model-runtime-test-utils.ts";
import { createTestResourceLoader } from "./utilities.ts";

const disconnected = "stream error: stream disconnected before completion: stream closed before response.completed";

class ResponseStream extends EventStream<AssistantMessageEvent, AssistantMessage> {
	constructor() {
		super(
			(event) => event.type === "done" || event.type === "error",
			(event) => {
				if (event.type === "done") return event.message;
				if (event.type === "error") return event.error;
				throw new Error("Unexpected stream event");
			},
		);
	}
}

function response(overrides: Partial<AssistantMessage> = {}): AssistantMessage {
	return {
		role: "assistant",
		api: "anthropic-messages",
		provider: "anthropic",
		model: "mock",
		content: [{ type: "text", text: "Recovered" }],
		stopReason: "stop",
		timestamp: Date.now(),
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		...overrides,
	};
}

describe("Responses disconnect session recovery", () => {
	let session: AgentSession | undefined;
	let directory: string | undefined;

	afterEach(() => {
		session?.dispose();
		if (directory) rmSync(directory, { recursive: true, force: true });
	});

	it("retries only the failed response, retains completed tool output, and does not execute partial tool calls", async () => {
		directory = mkdtempSync(join(tmpdir(), "pi-disconnect-recovery-"));
		let calls = 0;
		const executions: string[] = [];
		const projections: string[] = [];
		const model = getModel("anthropic", "claude-sonnet-4-5")!;
		const parameters = Type.Object({ text: Type.String() });
		const tool: AgentTool<typeof parameters> = {
			name: "echo",
			label: "Echo",
			description: "Synthetic side effect",
			parameters,
			execute: async (_id, args) => {
				executions.push(args.text);
				return { content: [{ type: "text", text: "retained-result" }], details: undefined };
			},
		};
		const agent = new Agent({
			getApiKey: () => "synthetic-key",
			initialState: { model, systemPrompt: "Synthetic recovery test", tools: [] },
			streamFn: (_model, context) => {
				calls++;
				projections.push(JSON.stringify(context.messages));
				const stream = new ResponseStream();
				queueMicrotask(() => {
					const message =
						calls === 1
							? response({
									stopReason: "toolUse",
									content: [{ type: "toolCall", id: "completed", name: "echo", arguments: { text: "once" } }],
								})
							: calls === 2
								? response({
										stopReason: "error",
										errorMessage: disconnected,
										content: [
											{ type: "text", text: "abandoned-partial-response" },
											{ type: "toolCall", id: "partial", name: "echo", arguments: { text: "never" } },
										],
									})
								: response();
					stream.push({ type: "start", partial: message });
					if (message.stopReason === "error") stream.push({ type: "error", reason: "error", error: message });
					else stream.push({ type: "done", reason: message.stopReason as "stop" | "toolUse", message });
				});
				return stream;
			},
		});
		const auth = AuthStorage.create(join(directory, "auth.json"));
		await auth.modify("anthropic", async () => ({ type: "api_key", key: "synthetic-key" }));
		const registry = await createModelRegistry(auth, directory);
		const settings = SettingsManager.create(directory, directory);
		settings.applyOverrides({ retry: { enabled: true, maxRetries: 3, baseDelayMs: 1 } });
		const history = SessionManager.inMemory();
		session = new AgentSession({
			agent,
			sessionManager: history,
			settingsManager: settings,
			cwd: directory,
			modelRuntime: getModelRuntime(registry),
			resourceLoader: createTestResourceLoader(),
			baseToolsOverride: { echo: tool },
		});
		const retries: string[] = [];
		session.subscribe((event) => {
			if (event.type === "auto_retry_start") retries.push(`start:${event.attempt}`);
			if (event.type === "auto_retry_end") retries.push(`end:${event.success}`);
		});
		await session.prompt("Perform the synthetic operation");
		expect(calls).toBe(3);
		expect(executions).toEqual(["once"]);
		expect(retries).toEqual(["start:1", "end:true"]);
		expect(projections[2]).toContain("retained-result");
		expect(projections[2]).not.toContain("abandoned-partial-response");
		expect(projections[2]).not.toContain('"id":"partial"');
		expect(history.getEntries().some((entry) => entry.type === "context_edit")).toBe(true);
		expect(session.isStreaming).toBe(false);
	});
});
