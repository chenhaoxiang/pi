// Security regressions against coding-agent's resolved npm Undici, not Node's bundled fetch.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { test } from "node:test";

const codingAgentPackage = new URL("../packages/coding-agent/package.json", import.meta.url);
const codingAgentRequire = createRequire(codingAgentPackage);
const { Agent, cacheStores, fetch, interceptors } = codingAgentRequire("undici");

async function closeServer(server) {
	server.closeAllConnections();
	await new Promise((resolve) => server.close(resolve));
}

test("coding-agent resolves the exact declared npm Undici dependency", () => {
	const declared = JSON.parse(readFileSync(codingAgentPackage, "utf8")).dependencies.undici;
	assert.equal(codingAgentRequire("undici/package.json").version, declared);
});

// GHSA-mqg3-3v4r-cm32 / GHSA-7xg3-fphp-28hg: adapted from Undici v8.12.4's cache-redirect-origin regression.
test("shared cache does not replay a private redirect result to an unauthenticated caller", { timeout: 10_000 }, async (t) => {
	const server = createServer((request, response) => {
		if (request.url === "/account") {
			if (request.headers.authorization) {
				response.writeHead(302, { "cache-control": "private, no-store", location: "/signed-object" });
				response.end();
			} else {
				response.writeHead(403, { "cache-control": "no-store" });
				response.end("denied");
			}
		} else if (request.url === "/signed-object") {
			response.writeHead(200, { "cache-control": "public, max-age=86400" });
			response.end("synthetic-private-body");
		} else {
			response.writeHead(404).end();
		}
	});
	const agent = new Agent().compose(
		interceptors.redirect({ maxRedirections: 2 }),
		interceptors.cache({ store: new cacheStores.MemoryCacheStore(), type: "shared" }),
	);
	t.after(async () => {
		await agent.close();
		await closeServer(server);
	});
	await once(server.listen(0, "127.0.0.1"), "listening");
	const origin = `http://127.0.0.1:${server.address().port}`;
	const authenticated = await agent.request({ origin, path: "/account", method: "GET", headers: { authorization: "Bearer synthetic" } });
	assert.equal(await authenticated.body.text(), "synthetic-private-body");
	const anonymous = await agent.request({ origin, path: "/account", method: "GET" });
	assert.equal(anonymous.statusCode, 403);
	assert.equal(await anonymous.body.text(), "denied");
});

// GHSA-mqg3-3v4r-cm32: a final same-origin hop cannot hide an earlier untrusted-origin bounce.
test("shared cache rejects alias poisoning through a cross-origin bounce", { timeout: 10_000 }, async (t) => {
	let redirectEnabled = true;
	let originHits = 0;
	const bounce = createServer((_request, response) => {
		response.writeHead(302, { location: `http://127.0.0.1:${origin.address().port}/cacheable` });
		response.end();
	});
	const origin = createServer((request, response) => {
		originHits++;
		if (request.url === "/alias" && redirectEnabled) {
			response.writeHead(302, { location: `http://127.0.0.1:${bounce.address().port}/bounce` });
			response.end();
		} else if (request.url === "/cacheable") {
			response.writeHead(200, { "cache-control": "public, max-age=86400" });
			response.end("synthetic-poison");
		} else {
			response.writeHead(200, { "cache-control": "no-store" });
			response.end("legitimate");
		}
	});
	const agent = new Agent().compose(
		interceptors.redirect({ maxRedirections: 3 }),
		interceptors.cache({ store: new cacheStores.MemoryCacheStore(), type: "shared" }),
	);
	t.after(async () => {
		await agent.close();
		await Promise.all([closeServer(origin), closeServer(bounce)]);
	});
	await Promise.all([once(origin.listen(0, "127.0.0.1"), "listening"), once(bounce.listen(0, "127.0.0.1"), "listening")]);
	const url = `http://127.0.0.1:${origin.address().port}`;
	const first = await agent.request({ origin: url, path: "/alias", method: "GET" });
	assert.equal(await first.body.text(), "synthetic-poison");
	redirectEnabled = false;
	const previousHits = originHits;
	const second = await agent.request({ origin: url, path: "/alias", method: "GET" });
	assert.equal(await second.body.text(), "legitimate");
	assert.equal(originHits, previousHits + 1);
});

// GHSA-9v6h-8rgp-m69f: tuple headers must lose credentials across origins, including with an outer normalizer.
test("cross-origin redirects strip tuple credentials while retaining nonsensitive headers", { timeout: 10_000 }, async (t) => {
	const received = [];
	const target = createServer((request, response) => {
		received.push(request.headers);
		response.end("redirected");
	});
	const origin = createServer((_request, response) => {
		response.writeHead(302, { location: `http://127.0.0.1:${target.address().port}/target` });
		response.end();
	});
	t.after(async () => {
		await Promise.all([closeServer(origin), closeServer(target)]);
	});
	await Promise.all([once(target.listen(0, "127.0.0.1"), "listening"), once(origin.listen(0, "127.0.0.1"), "listening")]);
	for (const normalizer of [interceptors.cache(), interceptors.deduplicate()]) {
		const agent = new Agent().compose(normalizer, interceptors.redirect({ maxRedirections: 1 }));
		try {
			const response = await agent.request({
				origin: `http://127.0.0.1:${origin.address().port}`,
				path: "/redirect",
				method: "GET",
				headers: [["Authorization", "synthetic"], ["Cookie", "session=synthetic"], ["Proxy-Authorization", "synthetic"], ["X-Keep", "present"]],
			});
			assert.equal(await response.body.text(), "redirected");
		} finally {
			await agent.close();
		}
	}
	assert.equal(received.length, 2);
	for (const headers of received) {
		assert.equal(headers.authorization, undefined);
		assert.equal(headers.cookie, undefined);
		assert.equal(headers["proxy-authorization"], undefined);
		assert.equal(headers["x-keep"], "present");
	}
});

// GHSA-r4pc-4jcp-7pqc: ASCII whitespace cannot bypass SRI, and the strongest supported digest still wins.
test("npm fetch enforces integrity metadata separated or surrounded by ASCII whitespace", { timeout: 10_000 }, async (t) => {
	const body = "synthetic integrity fixture";
	const valid = createHash("sha256").update(body).digest("base64");
	const wrong256 = createHash("sha256").update("different").digest("base64");
	const wrong512 = createHash("sha512").update("different").digest("base64");
	const server = createServer((_request, response) => response.end(body));
	const agent = new Agent();
	t.after(async () => {
		await agent.close();
		await closeServer(server);
	});
	await once(server.listen(0, "127.0.0.1"), "listening");
	const url = `http://127.0.0.1:${server.address().port}`;
	for (const whitespace of [" ", "\t", "\n", "\f", "\r"]) {
		for (const integrity of [`${whitespace}sha256-${wrong256}`, `sha256-${valid}${whitespace}sha512-${wrong512}`]) {
			await assert.rejects(fetch(url, { dispatcher: agent, integrity }), (error) => error.cause?.message === "integrity mismatch");
		}
		const response = await fetch(url, { dispatcher: agent, integrity: `${whitespace}sha256-${valid}` });
		assert.equal(await response.text(), body);
	}
});
