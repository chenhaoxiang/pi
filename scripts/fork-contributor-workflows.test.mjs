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
