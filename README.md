# Obsidian Tasks Kanban

A Kanban board view plugin for Obsidian that displays Tasks in a visual board layout.

## Features

- **Kanban Board View**: Display your tasks in a Kanban-style board with a column per status
- **Multiple Saved Boards**: Define several named boards, each with its own query and columns; open each in its own tab
- **Base Query**: A shared query merged into every board, so common filters live in one place
- **Custom Columns**: Optionally replace the default status columns with your own, mapping each column to specific status symbols (e.g. split "In Progress" into "Ongoing" `/` and "In Review" `A`)
- **Grouping (Swimlanes)**: Group cards into foldable lanes by status, priority, tags, path, folder, or filename
- **Sorting**: Sort cards by priority or a date field, ascending or descending
- **Filtering**: Search bar for title and tags, plus full Tasks-style query editing
- **Drag & Drop**: Move tasks between columns to change their status
- **Tasks Integration**: Listens to Tasks plugin events for real-time updates
- **Click to Open**: Click on any task card to open the source file

## Installation

### From the Community Plugins listing (recommended)

1. Install the [Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) plugin from Obsidian Community Plugins
2. Open **Settings → Community plugins → Browse**, search for **Tasks Kanban**, and click **Install** — or install directly from the [Community listing page](https://community.obsidian.md/plugins/tasks-kanban)
3. Enable both plugins in Obsidian Settings

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/Djiit/obsidian-tasks-kanban/releases/latest)
2. Copy them into your vault's `.obsidian/plugins/tasks-kanban/` folder
3. Reload Obsidian and enable both the Tasks and Tasks Kanban plugins in Settings

## Usage

### Opening a board

From the command palette:

- **Open board** — opens the default board
- **Open saved query…** — pick one of your saved boards to open
- **Open new blank board** — create a fresh board and start customizing it

Each board opens in its own tab; opening a board that's already open focuses its tab.

### Columns

By default the board shows one column per status type (Todo, In Progress, Done, Cancelled), derived from your Tasks status configuration.

You can instead define **custom columns** per board in Settings. Each custom column is a partition over status symbols — pick which statuses it collects, and the first one becomes the symbol written when you drop a card into it. This lets you, for example, split "In Progress" into separate "Ongoing" (`/`) and "In Review" (`A`) columns.

### Saved boards and the base query

A board's view is defined by a **query** (filters + sort + grouping) and its **columns**. In Settings you can:

- Edit the **base query**, merged on top of every board
- Add, rename, and delete **saved boards**, each with its own query and columns

Inline edits from a board's search/sort/group bars are saved back to that board.

### Filtering, sorting, and grouping

The board supports a subset of Tasks query syntax. For complete documentation, see [Query Syntax](docs/query-syntax.md).

**Filtering:**
- `tag includes #<tag>` — show tasks with the specified tag
- `description includes <text>` — show tasks whose description contains the text

**Sorting:**
- `sort by <field>` / `sort by <field> reverse`
- Fields: `due`, `scheduled`, `start`, `created`, `priority`

**Grouping** (into foldable swimlanes):
- `group by <field>` / `group by <field> reverse`
- Fields: `status`, `priority`, `tags`, `path`, `folder`, `filename`

Date-based grouping is intentionally not offered, since one lane per distinct date scatters the board.

The search and sort/group bars above the board edit the same query visually; the filter button opens the raw query editor.

### Drag & Drop

- Drag a task card from one column and drop it on another to change its status
- The dropped card takes the target column's status symbol
- The source file is updated and the board refreshes to show the new status

## Development

### Project Structure

```
obsidian-tasks-kanban/
├── .github/workflows/ci.yml         # GitHub Actions CI
├── src/
│   ├── main.ts                      # Plugin entry point, commands, persistence
│   ├── services/
│   │   ├── TasksIntegration.ts      # Integration with Tasks plugin + statuses
│   │   └── TaskUpdater.ts           # Update task status in source files
│   ├── views/
│   │   └── TasksBoardView.ts        # Kanban view (one per board id)
│   ├── components/
│   │   ├── KanbanBoard.ts           # Board logic (query, grouping, columns)
│   │   ├── KanbanLane.ts            # Swimlane (one per group)
│   │   ├── KanbanColumn.ts          # Column component (drop zone)
│   │   ├── KanbanCard.ts            # Task card component (draggable)
│   │   ├── SearchBar.ts             # Title + tag filter bar
│   │   ├── SortBar.ts               # Sort control
│   │   ├── GroupBar.ts              # Grouping control
│   │   ├── QueryModal.ts            # Raw query editor
│   │   └── BoardPickerModal.ts      # Saved-board picker
│   ├── query/
│   │   ├── boardQuery.ts            # Query parse/serialize/apply (filters+sort+group)
│   │   └── savedBoards.ts           # Saved-board list helpers
│   ├── utils/
│   │   ├── statusColumns.ts         # Default + custom column resolution
│   │   ├── groupTasks.ts            # Swimlane grouping
│   │   ├── sortTasks.ts             # Sorting
│   │   ├── searchFilter.ts          # Tag/title helpers
│   │   └── taskChips.ts             # Card metadata chips
│   ├── settings/
│   │   └── SettingsTab.ts           # Base query + saved boards + columns editor
│   └── types/
│       └── persistence.ts           # Persisted data model
├── styles.css                      # Board styles
├── manifest.json                   # Plugin manifest
├── package.json                    # Dependencies and scripts
└── AGENTS.md                       # Development guidelines
```

### Building

```bash
# Install dependencies
npm install

# Build for production (minified)
npm run build

# Development build (unminified)
npm run build:dev

# Watch mode for development
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint and test
npm run lint

# Format code
npm run format
```

### Development Commands (Obsidian CLI)

Use the [Obsidian CLI](https://help.obsidian.md/cli) for faster development:

| Command | Action |
|---------|--------|
| `obsidian plugin:reload id=obsidian-tasks-kanban` | Reload plugin without restarting Obsidian |
| `obsidian dev:errors` | Check for plugin errors |
| `obsidian dev:console level=error` | View console errors |
| `obsidian dev:screenshot path=screenshot.png` | Capture current view |
| `obsidian dev:dom selector=".workspace-leaf"` | Inspect DOM elements |
| `obsidian dev:css selector=".workspace-leaf" prop=background-color` | Check CSS values |
| `obsidian dev:mobile on` | Enable mobile emulation |
| `obsidian eval code="app.plugins.getPlugin('obsidian-tasks-kanban')"` | Access plugin instance |

### Quick Development Cycle

```bash
# In one terminal: watch for changes
npm run dev

# In another terminal or Obsidian CLI: reload after changes
npm run dev:reload

# Or use the full cycle
npm run dev:full
```

### Testing

Tests use Vitest with JSDom environment. Test files are in the `tests/` directory.

```bash
npm test        # Run all tests once
npm run test:watch  # Watch mode for development
```

## Architecture Notes

### Tasks Integration

The plugin integrates with Tasks via Obsidian's event system:
- Listens to `obsidian-tasks-plugin:cache-update` for real-time task updates
- Uses `obsidian-tasks-plugin:request-cache-update` to request initial data
- Accesses task data from the event payload

### Drag & Drop Implementation

- **Native HTML5 API**: Uses standard Drag & Drop events
- **Data Transfer**: Custom MIME types for task metadata
- **Status Update**: On drop, updates the task status in the source file
- **Auto-refresh**: Tasks plugin detects file changes and triggers cache update

### Type Definitions

The plugin defines its own `Task` interface to match the Tasks plugin's Task structure, allowing type-safe access to task properties.

### Styling

Uses Obsidian's CSS variables for theme compatibility:
- `--background-primary`, `--background-secondary`, `--background-tertiary`
- `--text-normal`, `--text-muted`, `--text-error`, `--text-warning`, `--text-success`
- `--background-modifier-border`, `--background-modifier-border-hover`

## Future Enhancements

- [x] Configurable columns (custom status-symbol columns per board)
- [x] Grouping by status, priority, tags, path, folder, or filename
- [x] Multiple saved boards, each with its own query and columns
- [ ] Column reordering via drag & drop
- [ ] Save view configuration in file frontmatter
- [ ] Mobile touch support for drag & drop
- [ ] Batch status updates
- [ ] Undo/Redo support

## Gotchas

- **Task ID Format**: Tasks plugin uses `^task-id` format for task identification
- **Status Symbols**: Tasks uses single character symbols (space, x, /, -, h, etc.)
- **File Access**: Use `app.vault.read()` and `app.vault.write()` for file operations
- **Event Timing**: Tasks may emit multiple cache-update events on startup
- **Duplicate Tasks**: Always deduplicate tasks by ID before processing

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`):
- Runs on push to `main` and `develop` branches
- Runs on pull requests to `main`
- Steps: Install → Test → Build

## License

MIT
