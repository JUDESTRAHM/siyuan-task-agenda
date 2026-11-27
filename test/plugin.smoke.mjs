import test from "node:test"; import assert from "node:assert/strict"; import Module from "node:module"; import path from "node:path";
const Orig = Module._load;
class Plugin { constructor(){ this.i18n={title:"t"}; this.bars=[]; } async loadData(){return {};} async saveData(){} addTopBar(o){ this.bars.push(o); } addCommand(){} }
test("plugin loads against mocked siyuan API, scans tasks, Pro locked without a key", async () => {
	Module._load = function (r, ...a) { return r === "siyuan" ? { Plugin, Dialog: class {}, showMessage() {}, confirm() {}, getFrontend: () => "desktop", openTab() {} } : Orig.call(this, r, ...a); };
	const calls = [];
	globalThis.fetch = async (p, o) => { const stmt = JSON.parse(o.body).stmt; calls.push(stmt); let data = [];
		if (/COUNT/.test(stmt)) data = [{ c: 5 }];
		else if (/\[x\]/.test(stmt)) data = [{ id: "d1", root_id: "r", box: "b", hpath: "/D", markdown: "- [X] Weekly 📅 2026-11-19 🔁 every week" }];
		else data = [{ id: "a", root_id: "r", box: "b", hpath: "/D", markdown: "- [ ] Rent 📅 2026-11-20" }, { id: "b", root_id: "r", box: "b", hpath: "/D", markdown: "- [ ] Later 2027-01-01" }];
		return { json: async () => ({ code: 0, data }) }; };
	const { createRequire } = await import("node:module"); const P = createRequire(import.meta.url)(path.resolve("index.js"));
	const p = new P(); await p.onload(); assert.equal(p.bars.length, 1); assert.equal(p.licensed, false);
	const r = await p.scan(new Date(2026, 10, 26)); assert.equal(r.groups.overdue.length, 1); assert.equal(r.groups.later.length, 1); assert.equal(r.total, 5); assert.equal(r.rollable.length, 1);
	assert.ok(calls.every((s) => /LIMIT \d+/.test(s) || /COUNT/.test(s)), "every list query is limited");
	Module._load = Orig;
});
