# Obsidian Tasks Kanban

A Kanban board view plugin for Obsidian that displays Tasks in a visual board layout.

## Features

- **Kanban Board View**: Display your tasks in a Kanban-style board with columns for each status
- **Status Columns**: Default columns for Todo, In Progress, and Done
- **Tasks Integration**: Listens to Tasks plugin events for real-time updates
- **Drag & Drop**: Move tasks between columns to change their status
- **Filtering**: Supports Tasks query syntax for filtering tasks
- **Click to Open**: Click on any task card to open the source file

## Installation

1. Install the [Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) plugin from Obsidian Community Plugins
2. Install this plugin (manual installation for now)
3. Enable both plugins in Obsidian Settings

## Usage

### Opening the Kanban Board

- Use the command palette: "Open Tasks Kanban Board"
- Or add a hotkey for the command

### View Layout

The Kanban board displays tasks in three default columns:
- **Todo**: Tasks with status symbol ` ` (space)
- **In Progress**: Tasks with status symbol `/`
- **Done**: Tasks with status symbol `x`

### Filtering

The board supports filtering using Tasks query syntax:
- `#tag` - Filter by tag
- `path:"folder"` - Filter by path
- `status:"x"` - Filter by status
- `due:2024-01-01` - Filter by due date
- `priority:1` - Filter by priority (1-3)

### Drag & Drop

- Drag a task card from one column
- Drop it on another column to change its status
- The source file is automatically updated
- The board refreshes to show the new status

## Development

### Project Structure

```
obsidian-tasks-kanban/
├── .github/
│   └── workflows/
│       └── ci.yml                 # GitHub Actions CI
├── src/
│   ├── main.ts                      # Plugin entry point
│   ├── services/
│   │   ├── TasksIntegration.ts      # Integration with Tasks plugin
│   │   └── TaskUpdater.ts           # Update task status in source files
│   ├── views/
│   │   └── TasksBoardView.ts        # Kanban view
│   ├── components/
│   │   ├── KanbanBoard.ts           # Board logic
│   │   ├── KanbanColumn.ts          # Column component (drop zone)
│   │   └── KanbanCard.ts            # Task card component (draggable)
│   └── filters/
│       └── TaskFilter.ts            # Task filtering
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

- [ ] Configurable columns (add/remove/reorder)
- [ ] Column-specific filters
- [ ] Grouping by tags, priority, or due date
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
