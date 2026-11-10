import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { parse } from "yaml";

for (const filename of ["approve-contributor.yml", "issue-gate.yml", "pr-gate.yml"]) {
	const workflow = parse(readFileSync(new URL(`../.github/workflows/${filename}`, import.meta.url), "utf8"));
	for (const [name, job] of Object.entries(workflow.jobs)) {
		test(`${filename}:${name} gates all steps to the exact community repository`, () => {
			assert.equal(job.if, "github.repository == 'earendil-works/pi'");
			for (const [repository, expected] of [
				["earendil-works/pi", true],
				["chenhaoxiang/pi", false],
				["someone/pi", false],
				["earendil-works/pi-copy", false],
			]) {
				assert.equal(runInNewContext(job.if, { github: { repository } }, { timeout: 100 }), expected, repository);
			}
		});
	}
}

test("p2 cloud bundle gates dispatch and successful main CI uploads to the community repository", () => {
	const workflow = parse(readFileSync(new URL("../.github/workflows/p2-cloud-bundle.yml", import.meta.url), "utf8"));
	const condition = workflow.jobs.publish.if;
	for (const repository of ["earendil-works/pi", "chenhaoxiang/pi", "someone/pi", "earendil-works/pi-copy"]) {
		for (const [eventName, run, eligible] of [
			["workflow_dispatch", undefined, true],
			["workflow_run", { conclusion: "success", event: "push", head_branch: "main", head_repository: { full_name: repository } }, true],
			["workflow_run", { conclusion: "failure", event: "push", head_branch: "main", head_repository: { full_name: repository } }, false],
			["workflow_run", { conclusion: "success", event: "pull_request", head_branch: "main", head_repository: { full_name: repository } }, false],
			["workflow_run", { conclusion: "success", event: "push", head_branch: "topic", head_repository: { full_name: repository } }, false],
			["workflow_run", { conclusion: "success", event: "push", head_branch: "main", head_repository: { full_name: "someone/other" } }, false],
		]) {
			const github = { repository, event_name: eventName, event: { workflow_run: run } };
			assert.equal(
				runInNewContext(condition, { github }, { timeout: 100 }),
				repository === "earendil-works/pi" && eligible,
				`${repository}: ${eventName}: ${JSON.stringify(run)}`,
			);
		}
	}
});
