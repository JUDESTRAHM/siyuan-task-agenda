// Pure logic for Task Agenda (no SiYuan/DOM). Dates are ISO strings (YYYY-MM-DD), compared as strings.
const pad = (n) => String(n).padStart(2, "0");
function valid(y, m, d) {
	if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1) return false;
	return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
function todayStr(now) { const n = now || new Date(); return iso(n.getFullYear(), n.getMonth() + 1, n.getDate()); }
function toUtc(s) { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); }
function fromUtc(t) { const x = new Date(t); return iso(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()); }
function addDays(s, n) { return fromUtc(toUtc(s) + n * 86400000); }
function addMonths(s, n) {
	const [y, m, d] = s.split("-").map(Number); const t = (y * 12 + (m - 1)) + n; const ny = Math.floor(t / 12), nm = (t % 12) + 1;
	return iso(ny, nm, Math.min(d, new Date(Date.UTC(ny, nm, 0)).getUTCDate()));
}
function diffDays(a, b) { return Math.round((toUtc(a) - toUtc(b)) / 86400000); }

const MARK = "(?:\\u{1F4C5}|\\u23F3|\\u{1F6EB}|due:?|deadline:?|on:?|@|\\u622A\\u6B62:?|\\u622A\\u6B62\\u65E5\\u671F:?)";
const DATE_RE = /(?<![\w\/.-])(\d{4})([-\/.])(\d{1,2})\2(\d{1,2})(?![\w\/-]|\.\d)|(\d{4})\u5E74(\d{1,2})\u6708(\d{1,2})\u65E5?/gu;
const MARK_BEFORE = new RegExp("(?<![\\p{L}\\d])" + MARK + "\\s*$", "iu");

// Finds the due date inside a task line. A date right after a marker (calendar emoji, due:, @) wins, else the first valid date.
function parseDate(text) {
	const s = String(text || ""); let first = null, marked = null; let m;
	DATE_RE.lastIndex = 0;
	while ((m = DATE_RE.exec(s))) {
		let y, mo, d, sep;
		if (m[1]) { y = +m[1]; mo = +m[3]; d = +m[4]; sep = m[2]; } else { y = +m[5]; mo = +m[6]; d = +m[7]; sep = "cn"; }
		if (!valid(y, mo, d)) continue;
		const hit = { date: iso(y, mo, d), start: m.index, end: m.index + m[0].length, sep };
		if (!first) first = hit;
		if (!marked && MARK_BEFORE.test(s.slice(0, m.index))) marked = hit;
	}
	return marked || first;
}
function formatLike(hit, ymd) {
	const [y, m, d] = ymd.split("-").map(Number);
	if (hit.sep === "cn") return `${y}\u5E74${m}\u6708${d}\u65E5`;
	if (hit.sep === "-") return ymd;
	return `${y}${hit.sep}${pad(m)}${hit.sep}${pad(d)}`;
}

// "every day", "every 2 weeks", "every weekday", also "daily/weekly/monthly/yearly", after the repeat marker or "repeat:".
const REC_RE = /(?:\u{1F501}|repeat:?)\s*(?:every\s*(\d+)?\s*(weekday|day|week|month|year)s?|(daily|weekly|monthly|yearly))/iu;
function parseRecur(text) {
	const m = REC_RE.exec(String(text || "")); if (!m) return null;
	if (m[3]) return { n: 1, unit: { daily: "day", weekly: "week", monthly: "month", yearly: "year" }[m[3].toLowerCase()] };
	const n = Math.max(1, Math.min(365, parseInt(m[1] || "1", 10) || 1)); return { n, unit: m[2].toLowerCase() };
}
function occurrence(base, rule, k) {
	switch (rule.unit) {
		case "day": return addDays(base, rule.n * k);
		case "week": return addDays(base, 7 * rule.n * k);
		case "month": return addMonths(base, rule.n * k);
		case "year": return addMonths(base, 12 * rule.n * k);
		case "weekday": { let d = base; for (let i = 0; i < rule.n * k; i++) { do d = addDays(d, 1); while ([0, 6].includes(new Date(toUtc(d)).getUTCDay())); } return d; }
	}
	return base;
}
// Next occurrence strictly after `due` and not before `today` (a missed repeat does not pile up as overdue).
function nextDue(due, rule, today) {
	let k = 1, d = occurrence(due, rule, k);
	while (d < today && k < 5000) { k++; d = occurrence(due, rule, k); }
	return d;
}

const MARKER_RE = /^\s*(?:[-*+]|\d{1,3}\.)\s+\[([ xX])\]\s?/;
function parseTask(row) {
	const line = String((row && row.markdown) || "").split("\n")[0]; const mk = MARKER_RE.exec(line); if (!mk) return null;
	const body = line.slice(mk[0].length).replace(/\{:[^}]*\}\s*$/, "").trim(); const hit = parseDate(body);
	return { id: row.id, rootId: row.root_id, box: row.box, path: row.hpath || "", done: mk[1] !== " ", text: body, due: hit ? hit.date : null, hit, recur: parseRecur(body) };
}
const SORT = (a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.text < b.text ? -1 : 1);
function group(tasks, today, windowDays) {
	const win = windowDays || 7; const g = { overdue: [], today: [], next: [], later: [] };
	for (const t of tasks) {
		if (t.done || !t.due) continue;
		if (t.due < today) g.overdue.push(t); else if (t.due === today) g.today.push(t); else if (diffDays(t.due, today) <= win) g.next.push(t); else g.later.push(t);
	}
	for (const k in g) g[k].sort(SORT); return g;
}
function relative(due, today) {
	const d = diffDays(due, today);
	return d === 0 ? { k: "today" } : d === 1 ? { k: "tomorrow" } : d === -1 ? { k: "yesterday" } : d > 0 ? { k: "in", n: d } : { k: "ago", n: -d };
}

// Rolls a finished recurring task: returns the new task's first line (open box, next date) or null.
function rollLine(task, today) {
	if (!task.done || !task.recur || !task.due) return null;
	const nd = nextDue(task.due, task.recur, today);
	const text = task.text.slice(0, task.hit.start) + formatLike(task.hit, nd) + task.text.slice(task.hit.end);
	return { due: nd, line: "- [ ] " + text };
}

function toMarkdown(g, labels) {
	const sec = (title, arr) => arr.length ? `## ${title} (${arr.length})\n\n` + arr.map((t) => `- [ ] ${t.text}${t.path ? ` (${t.path})` : ""}`).join("\n") + "\n\n" : "";
	return `# ${labels.title}\n\n` + sec(labels.overdue, g.overdue) + sec(labels.today, g.today) + sec(labels.next, g.next) + sec(labels.later, g.later);
}

const icsEsc = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function fold(line) { const out = []; let s = line; while (s.length > 73) { out.push(s.slice(0, 73)); s = " " + s.slice(73); } out.push(s); return out.join("\r\n"); }
const RRULE = { day: "DAILY", week: "WEEKLY", month: "MONTHLY", year: "YEARLY" };
function toIcs(tasks, now) {
	const stamp = (now || new Date()).toISOString().replace(/[-:]|\.\d+/g, "");
	const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Task Agenda for SiYuan//EN", "CALSCALE:GREGORIAN"];
	for (const t of tasks) {
		if (t.done || !t.due) continue;
		const d = t.due.replace(/-/g, ""); const title = t.text.replace(/\u{1F501}.*$/u, "").trim() || t.text;
		L.push("BEGIN:VEVENT", `UID:${String(t.id).replace(/[^\w-]/g, "")}@task-agenda`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${addDays(t.due, 1).replace(/-/g, "")}`, fold("SUMMARY:" + icsEsc(title)));
		if (t.path) L.push(fold("DESCRIPTION:" + icsEsc(t.path)));
		if (t.recur && t.recur.unit !== "weekday") L.push(`RRULE:FREQ=${RRULE[t.recur.unit]};INTERVAL=${t.recur.n}`);
		else if (t.recur) L.push("RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
		L.push("END:VEVENT");
	}
	L.push("END:VCALENDAR"); return L.join("\r\n") + "\r\n";
}
module.exports = { todayStr, addDays, addMonths, diffDays, parseDate, formatLike, parseRecur, nextDue, parseTask, group, relative, rollLine, toMarkdown, toIcs, icsEsc, MARKER_RE };
