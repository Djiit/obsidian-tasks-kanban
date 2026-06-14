# Query Syntax

The Tasks Kanban board supports a subset of the [Tasks](https://publish.obsidian.md/tasks) query syntax for filtering and sorting tasks on the board.

## Supported Instructions

Each instruction should be on its own line. Blank lines are ignored.

### Filtering

| Instruction | Description | Example |
|-------------|-------------|---------|
| `tag includes #<tag>` | Show tasks with the specified tag | `tag includes #work` |
| `description includes <text>` | Show tasks whose description contains the text (case-insensitive) | `description includes write tests` |

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

### Complete example
```
tag includes #work
tag includes #important
description includes write tests
sort by due reverse
```

## Notes

- Tag values should include the `#` prefix (e.g., `#work`, not `work`)
- Description matching is case-insensitive
- Multiple `tag includes` instructions are OR-ed together (a task matches if it has any of the tags)
- Multiple `description includes` instructions are AND-ed together (a task must match all descriptions)
- Sort instructions are applied after filtering
- Only the last sort instruction is used if multiple are provided

## Unsupported Tasks Query Syntax

The following Tasks query instructions are **not** supported and will be reported as errors:

- `path includes` / `path does not include`
- `filename includes` / `filename does not include`
- `priority is <value>` (use `sort by priority` for sorting)
- `due on` / `due before` / `due after` (date filtering)
- `scheduled on` / `scheduled before` / `scheduled after`
- `start on` / `start before` / `start after`
- `created on` / `created before` / `created after`
- `done` / `not done`
- `recurring` / `not recurring`
- `group by`
- `limit`
- Any other Tasks query instruction

For full Tasks query syntax, see the [Tasks documentation](https://publish.obsidian.md/tasks/Queries).
