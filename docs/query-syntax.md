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

> [!NOTE]
> The older negation spelling `tag not includes`, `path not includes`, and `folder not includes` still works but is **deprecated** and will show a warning; it will be removed in a future version. Use `does not include` instead.

### Sorting

| Instruction | Description | Example |
|-------------|-------------|---------|
| `sort by <field>` | Sort tasks by the specified field in ascending order | `sort by due` |
| `sort by <field> reverse` | Sort tasks by the specified field in descending order | `sort by due reverse` |

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

### Sort tasks
```
sort by due
```

### Sort in reverse order
```
sort by priority reverse
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
- Sort instructions are applied after filtering; grouping is applied last
- Only the last `sort by` / `group by` instruction is used if multiple are provided

## Unsupported Tasks Query Syntax

The following Tasks query instructions are **not** supported and will be reported as errors:

- `filename includes` / `filename does not include`
- `priority is <value>` (use `sort by priority` for sorting)
- `due on` / `due before` / `due after` (date filtering)
- `scheduled on` / `scheduled before` / `scheduled after`
- `start on` / `start before` / `start after`
- `created on` / `created before` / `created after`
- `done` / `not done`
- `recurring` / `not recurring`
- `group by <date field>` (e.g. `group by due`) — date grouping scatters the board; only `status`, `priority`, `tags`, `path`, `folder`, `filename` are supported
- `group by function` (arbitrary JavaScript)
- `limit`
- Any other Tasks query instruction

For full Tasks query syntax, see the [Tasks documentation](https://publish.obsidian.md/tasks/Queries).
