const { Plugin, Dialog, showMessage, confirm, getFrontend, openTab } = require("siyuan");
const core = require("./core.js");
const { verifyLicense } = require("./license.js");
const PLUGIN_ID = "siyuan-task-agenda";
const PRO_ENABLED = true;
const CHECKOUT = "https://sd-start.judestrahm.workers.dev/gx/sy/checkout?plugin=" + PLUGIN_ID;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const OPEN = "(markdown LIKE '_ [ ]%' OR markdown LIKE '_. [ ]%' OR markdown LIKE '__. [ ]%' OR markdown LIKE '___. [ ]%')";
const DONE = "(markdown LIKE '_ [x]%' OR markdown LIKE '_. [x]%' OR markdown LIKE '__. [x]%' OR markdown LIKE '___. [x]%')";
const DATED = "(markdown GLOB '*[0-9][0-9][0-9][0-9][-/.][0-9]*' OR markdown LIKE '%年%月%')";
const COLS = "id, root_id, box, hpath, markdown";

async function api(path, body) {
	const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) });
	const j = await r.json();
	if (j.code !== 0) throw new Error(j.msg || "SiYuan API error " + j.code);
	return j.data;
}
async function sqlAll(where, max) {
	const out = [];
	for (let off = 0; off < (max || 10000); off += 1000) {
		const rows = (await api("/api/query/sql", { stmt: `SELECT ${COLS} FROM blocks WHERE type = 'i' AND subtype = 't' AND ${where} ORDER BY id LIMIT 1000 OFFSET ${off}` })) || [];
		out.push(...rows); if (rows.length < 1000) break;
	}
	return out;
}
function download(name, text, mime) {
	const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: mime || "text/plain;charset=utf-8" })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

module.exports = class TaskAgenda extends Plugin {
	async onload() {
		const d = (await this.loadData("settings.json")) || {};
		this.cfg = Object.assign({ license: "", days: 7 }, d);
		this.licensed = PRO_ENABLED && !!verifyLicense(this.cfg.license, PLUGIN_ID);
		this.addTopBar({ icon: "iconCalendar", title: this.i18n.title, position: "right", callback: () => this.openDialog() });
		this.addCommand({ langKey: "open", hotkey: "", callback: () => this.openDialog() });
	}

	async scan(now) {
		const today = core.todayStr(now);
		const open = (await sqlAll(`${OPEN} AND ${DATED}`)).map(core.parseTask).filter((t) => t && t.due && !t.done);
		const total = ((await api("/api/query/sql", { stmt: `SELECT COUNT(*) AS c FROM blocks WHERE type = 'i' AND subtype = 't' AND ${OPEN}` })) || [{}])[0].c || 0;
		const rec = (await sqlAll(`${DONE} AND ${DATED} AND (markdown LIKE '%\u{1F501}%' OR markdown LIKE '%repeat%') AND id NOT IN (SELECT block_id FROM attributes WHERE name = 'custom-agenda-rolled')`, 3000))
			.map(core.parseTask).filter((t) => t && t.done && t.recur && t.due);
		return { today, tasks: open, groups: core.group(open, today, this.cfg.days), total, rollable: rec };
	}

	async markDone(id) {
		const k = await api("/api/block/getBlockKramdown", { id });
		const kd = String(k.kramdown).replace(/\[ \]/, "[X]");
		await api("/api/block/updateBlock", { dataType: "markdown", data: kd, id });
	}
	async roll(tasks, today) {
		let n = 0;
		for (const t of tasks) {
			const r = core.rollLine(t, today); if (!r) continue;
			await api("/api/block/insertBlock", { dataType: "markdown", data: r.line, previousID: t.id });
			await api("/api/attr/setBlockAttrs", { id: t.id, attrs: { "custom-agenda-rolled": r.due } }); n++;
		}
		return n;
	}
	rel(t, due, today) { const r = core.relative(due, today); return (t["rel_" + r.k] || "").replace("{n}", r.n); }
	jump(id) {
		try { openTab({ app: this.app, doc: { id, action: ["cb-get-focus", "cb-get-hl"] } }); } catch (e) { window.open("siyuan://blocks/" + id); }
	}

	async openDialog() {
		const t = this.i18n;
		const d = new Dialog({ title: t.title, width: /mobile/.test(getFrontend()) ? "96vw" : "720px", content: `<div class="b3-dialog__content" id="ta-body" style="max-height:72vh;overflow:auto">${esc(t.scanning)}</div>` });
		const body = d.element.querySelector("#ta-body");
		try {
			const rep = await this.scan(); const g = rep.groups; const byId = new Map(rep.tasks.map((x) => [x.id, x]));
			const row = (x, cls) => `<div class="b3-list-item" style="display:flex;gap:8px;align-items:flex-start;padding:5px 4px"><input type="checkbox" class="b3-switch" data-done="${esc(x.id)}" title="${esc(t.markDone)}" style="margin-top:4px">` +
				`<div class="fn__flex-1"><a href="#" data-open="${esc(x.id)}" style="color:inherit">${esc(x.text)}</a><div style="font-size:12px;opacity:.65"><span${cls ? ` style="color:var(--b3-card-error-color,#c0392b);opacity:1"` : ""}>${esc(x.due)} \u00B7 ${esc(this.rel(t, x.due, rep.today))}</span>${x.recur ? " · \u{1F501}" : ""} · ${esc(x.path)}</div></div></div>`;
			const sec = (title, arr, cls) => `<h4 style="margin:12px 0 4px">${esc(title)} (${arr.length})</h4>` + (arr.length ? arr.slice(0, 200).map((x) => row(x, cls)).join("") + (arr.length > 200 ? `<div style="opacity:.6">+${arr.length - 200}</div>` : "") : `<div style="opacity:.6">${esc(t.none)}</div>`);
			let h = `<div style="opacity:.8">${esc(t.summary.replace("{d}", rep.tasks.length).replace("{o}", g.overdue.length).replace("{t}", rep.total))}</div><div style="opacity:.6;font-size:12px;margin-top:2px">${esc(t.help)}</div>`;
			h += sec(t.overdue, g.overdue, true) + sec(t.today, g.today) + sec(t.next.replace("{n}", this.cfg.days), g.next) + sec(t.later, g.later);
			h += `<div style="margin-top:12px"><button class="b3-button b3-button--outline" id="ta-copy">${esc(t.copy)}</button> <button class="b3-button b3-button--outline" id="ta-rescan">${esc(t.rescan)}</button></div>`;
			if (PRO_ENABLED) h += this.proHtml(t, rep);
			body.innerHTML = h;
			body.addEventListener("click", (e) => { const a = e.target.closest && e.target.closest("[data-open]"); if (a) { e.preventDefault(); this.jump(a.dataset.open); } });
			body.addEventListener("change", async (e) => {
				const c = e.target.closest && e.target.closest("[data-done]"); if (!c) return;
				c.disabled = true;
				try { await this.markDone(c.dataset.done); c.closest(".b3-list-item").style.opacity = ".4"; byId.delete(c.dataset.done); }
				catch (err) { c.disabled = false; c.checked = false; showMessage(String(err.message || err), 6000, "error"); }
			});
			body.querySelector("#ta-copy").addEventListener("click", async () => {
				try { await navigator.clipboard.writeText(core.toMarkdown(g, { title: t.reportTitle, overdue: t.overdue, today: t.today, next: t.next.replace("{n}", this.cfg.days), later: t.later })); showMessage(t.copied); } catch (err) { showMessage(t.copyFail, 4000, "error"); }
			});
			body.querySelector("#ta-rescan").addEventListener("click", () => { d.destroy(); this.openDialog(); });
			if (PRO_ENABLED) this.proBind(d, body, t, rep);
		} catch (e) { body.textContent = String(e.message || e); }
	}

	proHtml(t, rep) {
		let h = `<hr><div><b>${esc(t.pro)}</b></div>`;
		if (this.licensed) h += `<div style="margin:6px 0"><button class="b3-button b3-button--outline" id="ta-roll"${rep.rollable.length ? "" : " disabled"}>${esc(t.roll.replace("{n}", rep.rollable.length))}</button> <button class="b3-button b3-button--outline" id="ta-ics">${esc(t.ics)}</button></div><div style="font-size:12px;opacity:.7">${esc(t.recurHelp)}</div><b>${esc(t.proActive)}</b>`;
		else h += `<div style="font-size:12px;opacity:.8;margin:4px 0">${esc(t.proList)} \u{1F512}${rep.rollable.length ? " " + esc(t.rollable.replace("{n}", rep.rollable.length)) : ""}</div>${esc(t.proOff)} <a href="${CHECKOUT}" target="_blank">${esc(t.buy)}</a>` +
			`<div style="display:flex;gap:6px;margin-top:6px"><input id="ta-lic" class="b3-text-field fn__flex-1" placeholder="${esc(t.licensePh)}" value="${esc(this.cfg.license || "")}"><button class="b3-button b3-button--text" id="ta-act">${esc(t.activate)}</button></div>`;
		return h;
	}
	proBind(d, body, t, rep) {
		const act = body.querySelector("#ta-act");
		if (act) act.addEventListener("click", async () => {
			const k = body.querySelector("#ta-lic").value.trim();
			if (!verifyLicense(k, PLUGIN_ID)) { showMessage(t.badKey, 6000, "error"); return; }
			this.cfg.license = k; this.licensed = true; await this.saveData("settings.json", this.cfg); showMessage(t.proActive); d.destroy(); this.openDialog();
		});
		if (!this.licensed) return;
		body.querySelector("#ta-ics").addEventListener("click", () => download("task-agenda.ics", core.toIcs(rep.tasks), "text/calendar;charset=utf-8"));
		body.querySelector("#ta-roll").addEventListener("click", () => {
			if (!rep.rollable.length) return;
			confirm(t.title, t.rollConfirm.replace("{n}", rep.rollable.length), async () => {
				try { const n = await this.roll(rep.rollable, rep.today); showMessage(t.rolled.replace("{n}", n)); d.destroy(); setTimeout(() => this.openDialog(), 1500); } catch (err) { showMessage(String(err.message || err), 6000, "error"); }
			});
		});
	}
};
