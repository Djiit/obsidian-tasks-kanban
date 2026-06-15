# Test Vault — Obsidian Tasks Kanban

Manual-testing fixtures for the Kanban board. Each note targets a category of
edge cases. Open the Kanban view and walk through the checklist in each file.

## Setup

1. Symlink or copy the built plugin into
   `.obsidian/plugins/tasks-kanban/` (`main.js`, `manifest.json`, `styles.css`).
2. Install the **Tasks** community plugin. The custom status config in
   `.obsidian/plugins/obsidian-tasks-plugin/data.json` defines these statuses:

   | Symbol | Name                       | Type        | Expected column |
   |--------|----------------------------|-------------|-----------------|
   | (space)| Todo                       | TODO        | Todo            |
   | `?`    | Question (custom)          | TODO        | Todo            |
   | `/`    | In Progress                | IN_PROGRESS | In Progress     |
   | `A`    | Active (custom)            | IN_PROGRESS | In Progress     |
   | `x`    | Done                       | DONE        | Done            |
   | `-`    | Cancelled                  | CANCELLED   | Cancelled       |
   | `b`    | Bookmark                   | NON_TASK    | (none — hidden) |

3. Reload Obsidian so Tasks picks up the config.

## Notes index

- `01 - Happy path.md` — well-formed tasks across every column.
- `02 - Long descriptions.md` — length / wrapping / truncation.
- `03 - Markdown in descriptions.md` — formatting, links, code, emoji, RTL.
- `04 - Status edge cases.md` — NON_TASK, unknown types, odd symbols.
- `05 - Malformed tasks.md` — non-standard bullets, broken checkboxes.
- `06 - Metadata edge cases.md` — priority, dates, tags, recurrence.
- `07 - Duplicates and identity.md` — identical lines across files.
- `08 - Volume.md` — many tasks for perf / scroll testing.
- `09 - Drag and drop targets.md` — tasks to move between columns.
- `10 - Dependencies dates priorities.md` — full metadata: all priorities, all
  date types, and task dependencies (🆔 id / ⛔ blocked-by) incl. chains & cycles.
