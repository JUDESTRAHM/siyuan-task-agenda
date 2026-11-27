# Task Agenda: Due Dates & Recurring

One window that shows every unfinished task with a date, across all notebooks, grouped as Overdue, Today, Next 7 days and Later. There is nothing to set up: it reads the dates you already type in your ordinary `- [ ]` task items. Free core (MIT), no telemetry, no network calls beyond your own SiYuan kernel.

## What it does (free)
- Click the calendar icon in the top bar (or run the command "Open Task Agenda").
- Reads dates written in task items: `2026-12-01`, `due:2026-12-01`, `@2026-12-01`, `2026/12/01`, `2026.12.01`, a calendar emoji followed by a date, or `2026年12月1日`. If a task has several dates, the one right after a marker (`due:`, `@`, calendar emoji) is used, otherwise the first valid date.
- Groups open tasks into Overdue, Today, Next 7 days and Later, each with how many days away it is and the document it lives in.
- Tick the box to finish a task (nested sub-tasks are kept), click the text to jump to it.
- Copies the agenda as Markdown.

## Pro (optional, one-time license)
- Recurring tasks: write a rule in the task, for example `Pay rent 📅 2026-12-01 🔁 every month`. Rules: `every day`, `every 3 days`, `every week`, `every 2 weeks`, `every weekday`, `every month`, `every year` (also `repeat: weekly`). When you finish it, click "Add next repeats": a new unchecked task with the next date is inserted under it. Months clamp to the last day (Jan 31 repeats on Feb 28), and a missed repeat does not pile up as overdue.
- Export your dated tasks to a calendar file (.ics) with all-day events and repeat rules, for Apple, Google or Outlook calendars.

The free tier never writes anything except the checkbox you tick. Pro "Add next repeats" inserts one new task per finished recurring task and tags the finished one with a `custom-agenda-rolled` attribute so it is never repeated twice.

## Install
Marketplace, then Plugins, search "Task Agenda".

## Notes
- Dates are read from the task's first line. Dates on child items belong to the child.
- A task is only repeated once it is checked and carries the repeat marker and a date.

## Develop
`npm install`, then `node build.mjs` bundles `src/plugin.js` into `index.js`. `npm test` runs the tests. `NB=<notebook id> node test/realkernel.mjs` runs the plugin against a local kernel on port 6806 (it creates and removes its own test document).

More from this developer: [Document Stats & Reading Time](https://github.com/JUDESTRAHM/siyuan-doc-stats), [Link Health](https://github.com/JUDESTRAHM/siyuan-link-health), [Database Charts & Reports](https://github.com/JUDESTRAHM/siyuan-db-reports), [Habit Heatmap & Streaks](https://github.com/JUDESTRAHM/siyuan-habit-heatmap), [Tag Tidy](https://github.com/JUDESTRAHM/siyuan-tag-tidy).
