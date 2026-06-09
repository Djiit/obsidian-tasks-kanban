# Obsidian Tasks Kanban

A Kanban board view plugin for Obsidian that displays Tasks in a visual board layout.

## Features

- **Kanban Board View**: Display your tasks in a Kanban-style board with columns for each status
- **Status Columns**: Default columns for Todo, In Progress, and Done
- **Tasks Integration**: Listens to Tasks plugin events for real-time updates
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

## Development

### Project Structure

```
obsidian-tasks-kanban/
├── src/
│   ├── main.ts                 # Plugin entry point
│   ├── services/
│   │   └── TasksIntegration.ts # Integration with Tasks plugin
│   ├── views/
│   │   └── TasksBoardView.ts   # Kanban view
│   ├── components/
│   │   ├── KanbanBoard.ts      # Board logic
│   │   ├── KanbanColumn.ts     # Column component
│   │   └── KanbanCard.ts       # Task card component
│   └── filters/
│       └── TaskFilter.ts       # Task filtering
├── styles.css                 # Board styles
├── manifest.json             # Plugin manifest
└── package.json              # Dependencies
```

### Building

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Watch mode
npm run dev

# Run tests
npm test
```

### Testing

Tests use Vitest with JSDom environment. Test files are in the `tests/` directory.

```bash
npm test        # Run all tests once
npm run test:watch  # Watch mode
```

## Architecture Notes

### Tasks Integration

The plugin integrates with Tasks via Obsidian's event system:
- Listens to `obsidian-tasks-plugin:cache-update` for task updates
- Uses `obsidian-tasks-plugin:request-cache-update` to request initial data
- Accesses task data from the event payload

### Type Definitions

The plugin defines its own `Task` interface to match the Tasks plugin's Task structure, allowing type-safe access to task properties.

### Styling

Uses Obsidian's CSS variables for theme compatibility:
- `--background-primary`, `--background-secondary`, `--background-tertiary`
- `--text-normal`, `--text-muted`, `--text-error`, `--text-warning`, `--text-success`
- `--background-modifier-border`, `--background-modifier-border-hover`

## Future Enhancements

- [ ] Drag & drop to change task status
- [ ] Configurable columns (add/remove/reorder)
- [ ] Column-specific filters
- [ ] Grouping by tags, priority, or due date
- [ ] Save view configuration
- [ ] Mobile touch support

## License

MIT
