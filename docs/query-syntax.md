# Query Syntax

The Tasks Kanban board supports a subset of the [Tasks](https://publish.obsidian.md/tasks) query syntax for filtering, sorting, and grouping tasks on the board.

## Supported Instructions

Each instruction should be on its own line. Blank lines are ignored.

### Filtering

| Instruction | Description | Example |
|-------------|-------------|---------|
| `tag includes #<tag>` | Show tasks with the specified tag | `tag includes #work` |
| `tag does not include #<tag>` | Hide tasks with the specified tag | `tag does not include #book` |
| `path includes <text>` | Show tasks whose full file path contains the text (case-insensitive; includes the file name) | `path includes 4-Projects` |
| `path does not include <text>` | Hide tasks whose file path contains the text | `path does not include Templates` |
| `folder includes <text>` | Show tasks whose containing folder contains the text (case-insensitive; folder only, no file name) | `folder includes 5-Areas/` |
| `folder does not include <text>` | Hide tasks whose containing folder contains the text | `folder does not include 6-Archive` |
| `description includes <text>` | Show tasks whose description contains the text (case-insensitive) | `description includes write tests` |
| `<date> before\|after\|on <date>` | Show tasks whose date is before, after or on the given date | `due before tomorrow` |
| `<date> <relative date>` | Show tasks whose date is `today`, `tomorrow` or `yesterday` | `due today` |
| `<date> in <period>` | Show tasks whose date falls in the period | `scheduled in this week` |
| `has <date> date` / `no <date> date` | Show tasks that have, or don't have, the date | `no due date` |

#### Date filters

`<date>` is one of `due`, `scheduled`, `start` (or `starts`), `created`, `done` and `cancelled`.

Dates can be absolute (`2026-07-10`) or relative: `today`, `tomorrow`, `yesterday`. Periods are `this week`, `next week`, `last week`, `this month`, `next month`, `last month` and `this year`; the `in` is optional (`due this week`).

| Goal | Instruction |
|------|-------------|
| Overdue | `due before today` |
| Due today | `due today` |
| Overdue or due today | `due before tomorrow` |
| Due in the future | `due after today` |
| Without a due date | `no due date` |

#### Combining filters

Several filters can go on one line, joined with Boolean operators, as in [Tasks](https://publish.obsidian.md/tasks/Queries/Combining+Filters). Wrap each filter in delimiters, then join them with `AND`, `OR`, `XOR`, `NOT`, `AND NOT` or `OR NOT`:

```
(due before tomorrow) OR (no due date)
```

- Operators must be capitalised.
- Delimiters can be `( )`, `[ ]`, `{ }` or `" "`. Use the same type throughout a line. Pick another type if a filter contains the delimiter itself: `[description includes (maybe)] OR [due today]`.
- Operators apply in this order: `NOT`, `XOR`, `AND`, `OR`. Nest delimiters to group: `((due today) OR (no due date)) AND NOT (tag includes #someday)`.
- Any filter above can be combined. `sort by` and `group by` cannot.
- Each filter in a Boolean line matches on its own, so `(tag includes #a) AND (tag includes #b)` requires both tags.

> [!NOTE]
> The older negation spelling `tag not includes`, `path not includes`, and `folder not includes` still works but is **deprecated** and will show a warning; it will be removed in a future version. Use `does not include` instead.

### Sorting

| Instruction | Description | Example |
|-------------|-------------|---------|
| `sort by <field>` | Sort tasks by the specified field in ascending order | `sort by due` |
| `sort by <field> reverse` | Sort tasks by the specified field in descending order | `sort by due reverse` |

Add several `sort by` lines to sort by more than one field. As in Tasks, the first line sorts first, and each later line orders the tasks that tie on the lines before it. Tasks that tie on every line are ordered by description.

#### Supported Sort Fields

- `due` - Due date
- `scheduled` - Scheduled date
- `start` - Start date
- `created` - Creation date
- `priority` - Priority

### Grouping

Grouping splits the board into horizontal swimlanes — one lane per distinct value of the chosen field. Lanes are foldable.

| Instruction | Description | Example |
|-------------|-------------|---------|
| `group by <field>` | Group tasks into swimlanes by the specified field | `group by priority` |
| `group by <field> reverse` | Group, reversing the lane order | `group by status reverse` |

#### Supported Group Fields

- `status` - Status name
- `priority` - Priority
- `tags` - Tags (a multi-tag task appears in each of its tag lanes)
- `path` - Full file path
- `folder` - Containing folder
- `filename` - File name (without `.md`)

Date-based grouping (`due`, `scheduled`, etc.) is intentionally not supported: one lane per distinct date scatters the board.

## Examples

### Filter by tag
```
tag includes #work
```

### Filter by multiple tags (OR logic)
```
tag includes #work
tag includes #personal
```

### Filter by description
```
description includes write documentation
```

### Filter by note path or folder
```
path includes 4-Projects
```

or scope to several folders (OR logic):
```
path includes 4-Projects
path includes 5-Areas/
```

and exclude a folder:
```
folder includes 4-Projects
folder does not include 6-Archive
```

### Combine filters
```
tag includes #project
description includes urgent
```

### Overdue, due today, or without a due date
```
(due before tomorrow) OR (no due date)
```

### Work tasks due this week, except someday ones
```
tag includes #work
(due this week) AND NOT (tag includes #someday)
```

### Sort tasks
```
sort by due
```

### Sort in reverse order
```
sort by priority reverse
```

### Sort by priority, then newest first
```
sort by priority
sort by created reverse
```

### Group into swimlanes
```
group by priority
```

### Complete example
```
tag includes #work
tag includes #important
description includes write tests
sort by due reverse
group by priority
```

## Notes

- Tag values should include the `#` prefix (e.g., `#work`, not `work`)
- Description matching is case-insensitive
- Path and folder matching is case-insensitive substring matching, mirroring Tasks: `path` matches the full file path (including the file name), `folder` matches the containing folder only
- Multiple `tag includes` instructions are OR-ed together (a task matches if it has any of the tags)
- Multiple `path includes` (or `folder includes`) instructions are OR-ed together; negations and different filter kinds are AND-ed together
- Multiple `description includes` instructions are AND-ed together (a task must match all descriptions)
- Date filters and Boolean lines are AND-ed with every other line
- Sort instructions are applied after filtering; grouping is applied last
- Multiple `sort by` instructions all apply, in order; the sort bar shows and changes the first one
- Only the last `group by` instruction is used if multiple are provided
- A board's own `sort by` lines replace the base query's `sort by` lines as a whole

## Unsupported Tasks Query Syntax

The following Tasks query instructions are **not** supported and will be reported as errors:

- `filename includes` / `filename does not include`
- `priority is <value>` (use `sort by priority` for sorting)
- Date ranges (`due in 2026-07-01 2026-07-10`) and relative dates beyond those listed above (e.g. `due before in two weeks`)
- `happens` date filters
- `done` / `not done`
- `recurring` / `not recurring`
- `group by <date field>` (e.g. `group by due`) — date grouping scatters the board; only `status`, `priority`, `tags`, `path`, `folder`, `filename` are supported
- `group by function` (arbitrary JavaScript)
- `limit`
- Any other Tasks query instruction

For full Tasks query syntax, see the [Tasks documentation](https://publish.obsidian.md/tasks/Queries).
