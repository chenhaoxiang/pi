#!/usr/bin/env node
// Verify the actual CLI's installed fetch and scheduled capabilities using only loopback fixtures.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";

const marker = "PI_HTTP_DISPATCHER_BINARY_SMOKE_OK";
const body = "synthetic dispatcher integrity fixture";
const digest = createHash("sha256").update(body).digest("base64");
const wrong = createHash("sha512").update("different").digest("base64");
if (process.argv.length !== 3) {
	throw new Error("Usage: node scripts/smoke-test-http-dispatcher-binary.mjs <pi-binary>");
}
const binary = resolve(process.argv[2]);
const root = await mkdtemp(join(tmpdir(), "pi-http-dispatcher-smoke-"));
let completions = 0;
const server = createServer((request, response) => {
	if (request.method === "GET" && request.url === "/integrity") {
		response.end(body);
		return;
	}
	if (request.method !== "POST" || request.url !== "/v1/chat/completions") {
		response.writeHead(404).end();
		return;
	}
	request.resume();
	completions++;
	response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
	const chunk = {
		id: "synthetic-dispatcher",
		object: "chat.completion.chunk",
		created: 0,
		model: "dispatcher-smoke",
		choices: [{ index: 0, delta: { role: "assistant", content: marker }, finish_reason: "stop" }],
	};
	response.end(`data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`);
});
try {
	await new Promise((done) => server.listen(0, "127.0.0.1", done));
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("Loopback server did not bind");
	const origin = `http://127.0.0.1:${address.port}`;
	await writeFile(
		join(root, "models.json"),
		JSON.stringify({
			providers: {
				"dispatcher-smoke": {
					api: "openai-completions",
					baseUrl: `${origin}/v1`,
					apiKey: "synthetic",
					models: [{ id: "dispatcher-smoke" }],
				},
			},
		}),
	);
	const extension = join(root, "dispatcher-check.mjs");
	await writeFile(extension, `
import assert from "node:assert/strict";
export default async function (pi) {
	const url = ${JSON.stringify(`${origin}/integrity`)};
	for (const space of [" ", "\\t", "\\n", "\\f", "\\r"]) {
		await assert.rejects(globalThis.fetch(url, {
			integrity: "sha256-${digest}" + space + "sha512-${wrong}"
		}), error => error.cause?.message === "integrity mismatch");
		const response = await globalThis.fetch(url, { integrity: space + "sha256-${digest}" });
		assert.equal(await response.text(), ${JSON.stringify(body)});
	}
	console.log("PI_HTTP_GLOBALS_SRI_OK");
	pi.on("session_start", (_event, ctx) => {
		assert.equal(ctx.scheduledExecution.version, 1);
		assert.equal(ctx.scheduledExecution.unattendedInputGuardVersion, 1);
		console.log("PI_NATIVE_SCHEDULED_INPUT_GUARD_V1_OK");
	});
}
`);
	const args = [
		"--provider", "dispatcher-smoke",
		"--model", "dispatcher-smoke",
		"--print", "--no-tools", "--no-session", "--offline", "--no-context-files",
		"--no-skills", "--no-prompt-templates", "--no-themes",
		"--extension", extension,
		"Synthetic loopback dispatcher verification only",
	];
	const js = extname(binary) === ".js";
	const child = spawn(js ? process.execPath : binary, js ? [binary, ...args] : args, {
		cwd: root,
		env: { ...process.env, PI_CODING_AGENT_DIR: root, PI_OFFLINE: "1" },
		stdio: ["ignore", "pipe", "pipe"],
	});
	let stdout = "";
	let stderr = "";
	child.stdout.on("data", (bytes) => { stdout += bytes; });
	child.stderr.on("data", (bytes) => { stderr += bytes; });
	const exit = await new Promise((done, reject) => {
		const timer = setTimeout(() => {
			child.kill();
			reject(new Error("Dispatcher smoke timed out"));
		}, 30_000);
		child.once("error", (error) => {
			clearTimeout(timer);
			reject(error);
		});
		child.once("close", (code) => {
			clearTimeout(timer);
			done(code);
		});
	});
	const output = stdout + stderr;
	assert.equal(exit, 0, stderr);
	// Node's CLI redirects extension console output to stderr; Bun retains it on stdout.
	assert.ok(output.includes("PI_HTTP_GLOBALS_SRI_OK"), output);
	assert.ok(output.includes("PI_NATIVE_SCHEDULED_INPUT_GUARD_V1_OK"), output);
	assert.ok(stdout.includes(marker), output);
	assert.equal(completions, 1);
	console.log(output.trim());
} finally {
	server.closeAllConnections();
	await new Promise((done) => server.close(done));
	await rm(root, { recursive: true, force: true });
}
