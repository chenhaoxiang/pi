import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ScheduledRunCheckpoint } from "../../src/core/scheduled-execution.ts";
import { createHarness, type Harness } from "./harness.ts";

describe("native unattended input guard", () => {
	let harness: Harness | undefined;
	afterEach(() => harness?.cleanup());

	it.each(["direct", "late-direct", "late-nested"])(
		"blocks %s questions at the actual native boundary without invoking UI",
		async (mode) => {
			const question = vi.fn(async () => ({
				content: [{ type: "text" as const, text: "UNSAFE_UI_OPENED" }],
				details: {},
			}));
			harness = await createHarness({
				extensionFactories: [
					(pi) => {
						const register = () =>
							pi.registerTool({
								name: "ask_user_question",
								label: "Question",
								description: "Synthetic UI",
								parameters: Type.Object({}),
								execute: question,
							});
						if (mode === "direct") register();
						else {
							let registered = false;
							pi.on("tool_execution_end", () => {
								if (!registered) {
									registered = true;
									register();
									pi.setActiveTools([...pi.getActiveTools(), "ask_user_question"]);
								}
							});
						}
						pi.registerTool({
							name: "nested_question",
							label: "Nested",
							description: "Synthetic nested question",
							parameters: Type.Object({}),
							execute: async (_id, _args, _signal, _update, ctx) =>
								(await ctx.executeTool("ask_user_question", {})).result,
						});
					},
				],
			});
			const input = join(harness.tempDir, "fixture.txt");
			writeFileSync(input, "Synthetic read before late tool registration");
			const questionResponse = fauxAssistantMessage(
				fauxToolCall(mode === "late-nested" ? "nested_question" : "ask_user_question", {}, { id: "question" }),
				{ stopReason: "toolUse" },
			);
			harness.setResponses([
				...(mode === "direct"
					? []
					: [
							fauxAssistantMessage(fauxToolCall("read", { path: input }, { id: "first-read" }), {
								stopReason: "toolUse",
							}),
						]),
				questionResponse,
				fauxAssistantMessage("must not need a bookkeeping inference"),
			]);
			const accepted = harness.session.scheduledExecution.start({
				binding: {
					jobId: "fixture",
					attemptId: mode,
					ownerSessionId: harness.session.sessionId,
					ownerEpoch: 1,
					revision: 1,
				},
				policy: { softDeadlineMs: 10000, hardDeadlineMs: 20000 },
				content: "Synthetic unattended work",
			});
			if (!accepted.accepted) throw new Error(accepted.reason);
			const receipt = await accepted.handle.settled;
			expect(question).not.toHaveBeenCalled();
			expect(receipt.execution).toBe("deferred");
			expect(receipt.reason).toBe("user_input_required");
			const entry = harness.sessionManager.getEntry(receipt.checkpointEntryId);
			if (entry?.type !== "custom") throw new Error("Missing native checkpoint");
			expect((entry.data as ScheduledRunCheckpoint).declarations.waitingReason).toBe("user_input_required");
			expect(harness.faux.state.callCount).toBe(mode === "direct" ? 1 : 2);
		},
	);

	it("keeps ordinary user questions unchanged", async () => {
		const question = vi.fn(async () => ({
			content: [{ type: "text" as const, text: "ordinary answer" }],
			details: {},
		}));
		harness = await createHarness({
			extensionFactories: [
				(pi) =>
					pi.registerTool({
						name: "ask_user_question",
						label: "Question",
						description: "Synthetic UI",
						parameters: Type.Object({}),
						execute: question,
					}),
			],
		});
		harness.setResponses([
			fauxAssistantMessage(fauxToolCall("ask_user_question", {}, { id: "ordinary" }), { stopReason: "toolUse" }),
			fauxAssistantMessage("done"),
		]);
		await harness.session.prompt("Ordinary user interaction");
		expect(question).toHaveBeenCalledOnce();
	});
});
