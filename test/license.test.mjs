import test from "node:test"; import assert from "node:assert/strict";
import { createRequire } from "node:module"; import { execFileSync } from "node:child_process"; import fs from "node:fs"; import os from "node:os"; import { fileURLToPath } from "node:url";
const { verifyLicense } = createRequire(import.meta.url)("../src/license.js");
test("garbage keys rejected", () => { assert.equal(verifyLicense("", "siyuan-task-agenda"), null); assert.equal(verifyLicense("BR1.x.y", "siyuan-task-agenda"), null); assert.equal(verifyLicense(null, "siyuan-task-agenda"), null); });
test("real signer key accepted only for task-agenda", { skip: !fs.existsSync(os.homedir() + "/.config/strahm/ob-license.json") }, () => {
	const sign = fileURLToPath(new URL("../../siyuan-db-reports/tools/sign.mjs", import.meta.url));
	const key = execFileSync(process.execPath, [sign, "siyuan-task-agenda", "test@example.org", "cs_test_selfcheck00"]).toString().trim();
	assert.equal(verifyLicense(key, "siyuan-task-agenda").p, "siyuan-task-agenda"); assert.equal(verifyLicense(key, "siyuan-tag-tidy"), null);
});
