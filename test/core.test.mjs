import test from "node:test"; import assert from "node:assert/strict"; import { createRequire } from "node:module";
const c = createRequire(import.meta.url)("../src/core.js");
const T = "2026-11-26";
test("parseDate: formats, markers, invalid, urls", () => {
	assert.equal(c.parseDate("Pay rent 📅 2026-11-20").date, "2026-11-20");
	assert.equal(c.parseDate("x due:2026-12-01").date, "2026-12-01");
	assert.equal(c.parseDate("x @2026/12/05").date, "2026-12-05");
	assert.equal(c.parseDate("交房租 2026年12月3日").date, "2026-12-03");
	assert.equal(c.parseDate("2026-01-05 start, due 2026-03-09").date, "2026-03-09", "marked date wins");
	assert.equal(c.parseDate("Version 2026-13-45"), null);
	assert.equal(c.parseDate("see https://x.com/2026-11-30/page"), null);
	assert.equal(c.parseDate("leap 2027-02-29 and 2028-02-29").date, "2028-02-29");
	assert.equal(c.parseDate("no date here"), null);
	assert.equal(c.parseDate("call mom on 2026-12-24").date, "2026-12-24");
});
test("date math: months clamp, weekday skip", () => {
	assert.equal(c.addMonths("2026-01-31", 1), "2026-02-28"); assert.equal(c.addMonths("2026-12-15", 2), "2027-02-15");
	assert.equal(c.addDays("2026-12-31", 1), "2027-01-01"); assert.equal(c.diffDays("2026-12-01", "2026-11-26"), 5);
});
test("parseRecur", () => {
	assert.deepEqual(c.parseRecur("x 🔁 every week"), { n: 1, unit: "week" }); assert.deepEqual(c.parseRecur("x 🔁 every 2 weeks"), { n: 2, unit: "week" });
	assert.deepEqual(c.parseRecur("x repeat: monthly"), { n: 1, unit: "month" }); assert.deepEqual(c.parseRecur("x 🔁every weekday"), { n: 1, unit: "weekday" });
	assert.equal(c.parseRecur("we meet every week"), null, "needs the repeat marker");
});
test("nextDue skips missed repeats, keeps cadence", () => {
	assert.equal(c.nextDue("2026-11-19", { n: 1, unit: "week" }, T), "2026-11-26");
	assert.equal(c.nextDue("2026-10-01", { n: 1, unit: "week" }, T), "2026-11-26");
	assert.equal(c.nextDue("2026-10-31", { n: 1, unit: "month" }, T), "2026-11-30");
	assert.equal(c.nextDue("2026-11-20", { n: 1, unit: "weekday" }, T), "2026-11-26");
	assert.equal(c.nextDue("2026-11-27", { n: 1, unit: "weekday" }, T), "2026-11-30", "Fri to Mon");
	assert.equal(c.nextDue("2026-11-24", { n: 2, unit: "day" }, T), "2026-11-26");
});
const row = (id, md) => ({ id, root_id: "r", box: "b", hpath: "/Doc", markdown: md });
test("parseTask: markers, done flag, ordered lists, children ignored", () => {
	const a = c.parseTask(row("1", "- [ ] Pay rent 📅 2026-11-20")); assert.equal(a.done, false); assert.equal(a.due, "2026-11-20");
	const b = c.parseTask(row("2", "- [X] Weekly 📅 2026-11-19 🔁 every week")); assert.equal(b.done, true); assert.equal(b.recur.unit, "week");
	assert.equal(c.parseTask(row("3", "1. [ ] ordered 2026-12-01")).due, "2026-12-01");
	assert.equal(c.parseTask(row("4", "- [ ] parent\n  - [ ] child 2026-11-28")).due, null);
	assert.equal(c.parseTask(row("5", "- plain bullet 2026-11-28")), null);
	assert.equal(c.parseTask(row("6", "- [ ] text 2026-11-28\n{: id=\"x\"}")).due, "2026-11-28");
});
test("group buckets and sort", () => {
	const ts = ["2026-11-20", "2026-11-26", "2026-11-30", "2026-12-03", "2027-02-01", "2026-11-10"].map((d, i) => c.parseTask(row("i" + i, `- [ ] t${i} ${d}`)));
	ts.push(c.parseTask(row("d", "- [X] done 2026-11-01")));
	const g = c.group(ts, T, 7);
	assert.deepEqual(g.overdue.map((x) => x.due), ["2026-11-10", "2026-11-20"]); assert.equal(g.today.length, 1);
	assert.deepEqual(g.next.map((x) => x.due), ["2026-11-30", "2026-12-03"]); assert.equal(g.later.length, 1);
});
test("rollLine builds next open task, keeps date format", () => {
	const t = c.parseTask(row("1", "- [X] Weekly review 📅 2026-11-19 🔁 every week"));
	assert.deepEqual(c.rollLine(t, T), { due: "2026-11-26", line: "- [ ] Weekly review 📅 2026-11-26 🔁 every week" });
	const cn = c.parseTask(row("2", "- [X] 交房租 2026年11月1日 🔁 every month")); assert.equal(c.rollLine(cn, T).line, "- [ ] 交房租 2026年12月1日 🔁 every month");
	assert.equal(c.rollLine(c.parseTask(row("3", "- [ ] open 2026-11-19 🔁 every week")), T), null, "open tasks are not rolled");
	assert.equal(c.rollLine(c.parseTask(row("4", "- [X] no rule 2026-11-19")), T), null);
});
test("toIcs escapes, folds, adds RRULE, skips done and undated", () => {
	const ts = [c.parseTask(row("a1", "- [ ] Pay rent, now; ok 📅 2026-12-01 🔁 every 2 weeks")), c.parseTask(row("a2", "- [X] done 2026-12-02")), c.parseTask(row("a3", "- [ ] none"))];
	const ics = c.toIcs(ts, new Date("2026-11-26T12:00:00Z"));
	assert.match(ics, /DTSTART;VALUE=DATE:20261201\r\nDTEND;VALUE=DATE:20261202/); assert.match(ics, /RRULE:FREQ=WEEKLY;INTERVAL=2/); assert.match(ics, /SUMMARY:Pay rent\\, now\; ok 📅 2026-12-01\r\n/);
	assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1); assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
	const long = c.parseTask(row("b", "- [ ] " + "x".repeat(200) + " 2026-12-01")); assert.ok(c.toIcs([long]).split("\r\n").every((l) => l.length <= 75));
});
test("toMarkdown", () => {
	const g = c.group([c.parseTask(row("1", "- [ ] a 2026-11-20"))], T, 7);
	assert.match(c.toMarkdown(g, { title: "T", overdue: "Overdue", today: "Today", next: "N", later: "L" }), /## Overdue \(1\)\n\n- \[ \] a 2026-11-20 \(\/Doc\)/);
});
