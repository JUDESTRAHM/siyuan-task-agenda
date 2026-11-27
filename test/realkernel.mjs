// Run against a headless SiYuan kernel on :6806 (notebook id via NB env). Seeds its own doc, then exercises scan, markDone and roll. Usage: NB=<notebook id> node test/realkernel.mjs
import Module from "node:module"; import path from "node:path"; import assert from "node:assert/strict"; import { execFileSync } from "node:child_process"; import { fileURLToPath } from "node:url";
const Orig = Module._load;
class Plugin { constructor(){ this.i18n={}; this.app={}; } async loadData(){ return { license: LIC }; } async saveData(){} addTopBar(){} addCommand(){} }
const sign = fileURLToPath(new URL("../../siyuan-db-reports/tools/sign.mjs", import.meta.url));
const LIC = execFileSync(process.execPath, [sign, "siyuan-task-agenda", "test@example.org", "cs_test_realkernel0"]).toString().trim();
Module._load = function (r, ...a) { return r === "siyuan" ? { Plugin, Dialog: class {}, showMessage() {}, confirm() {}, getFrontend: () => "desktop", openTab() {} } : Orig.call(this, r, ...a); };
const f = globalThis.fetch; globalThis.fetch = (p, o) => f("http://127.0.0.1:6806" + p, o);
const post = async (p, b) => (await (await f("http://127.0.0.1:6806" + p, { method: "POST", body: JSON.stringify(b) })).json()).data;
const { createRequire } = await import("node:module"); const P = createRequire(import.meta.url)(path.resolve("index.js"));
const core = createRequire(import.meta.url)(path.resolve("src/core.js"));
const NB = process.env.NB; const today = core.todayStr(); const D = (n) => core.addDays(today, n);
const md = [`- [ ] Pay rent 📅 ${D(-6)}`, `- [ ] Call dentist due:${today}`, `- [ ] Submit report @${D(4)}`, `- [ ] Plan trip ${D(60)}`, `- [x] Weekly review 📅 ${D(-7)} 🔁 every week`, `- [ ] No date task`, `- [ ] Bad 2026-13-45`, `- [ ] Parent 📅 ${D(1)}\n  - [ ] child ${D(2)}`].join("\n");
const doc = await post("/api/filetree/createDocWithMd", { notebook: NB, path: "/agenda-" + Date.now(), markdown: md });
await new Promise((s) => setTimeout(s, 3000));
const p = new P(); await p.onload(); assert.equal(p.licensed, true);
let r = await p.scan(); const mine = (arr) => arr.filter((t) => t.rootId === doc);
const g = (k) => mine(r.groups[k]).map((t) => t.text.split(" ")[0] + " " + t.text.split(" ")[1]);
console.log(JSON.stringify({ overdue: g("overdue"), today: g("today"), next: g("next"), later: g("later"), total: r.total, rollable: mine(r.rollable).length }));
assert.equal(mine(r.groups.overdue).length, 1); assert.equal(mine(r.groups.today).length, 1); assert.equal(mine(r.groups.next).length, 3, "report + parent + nested child"); assert.equal(mine(r.groups.later).length, 1);
// the nested child is its own task item and should appear too
assert.ok(r.tasks.some((t) => t.rootId === doc && t.text.startsWith("child")));
assert.equal(mine(r.rollable).length, 1);
// mark done keeps nested children and flips the box
const parent = mine(r.tasks).find((t) => t.text.startsWith("Parent"));
await p.markDone(parent.id); await new Promise((s) => setTimeout(s, 2000));
const after = await post("/api/query/sql", { stmt: `SELECT id, markdown FROM blocks WHERE id = '${parent.id}'` });
assert.ok(/^- \[X\] Parent/.test(after[0].markdown), after[0].markdown); assert.ok(/child/.test(after[0].markdown), "child survived");
// roll forward
const n = await p.roll(mine(r.rollable), r.today); assert.equal(n, 1); await new Promise((s) => setTimeout(s, 2500));
r = await p.scan(); assert.equal(mine(r.rollable).length, 0, "no second roll");
const nextTask = mine(r.tasks).find((t) => t.text.startsWith("Weekly review")); assert.ok(nextTask, "next occurrence inserted as open task"); assert.equal(nextTask.due, core.nextDue(D(-7), { n: 1, unit: "week" }, today));
const again = await p.roll(mine(r.rollable), r.today); assert.equal(again, 0);
await post("/api/filetree/removeDocByID", { id: doc });
console.log("real kernel OK");
