# AGENTS.md - Obsidian Tasks Kanban Plugin

## About the Project

**Name**: Obsidian Tasks Kanban
**Description**: Kanban board view plugin for Obsidian that displays Tasks in a visual board layout with drag & drop support.

## Development Rules

### Code Style

- **Language**: TypeScript
- **Framework**: Obsidian Plugin API
- **Build Tool**: esbuild
- **Package Manager**: npm (pnpm preferred if available)
- **Test Framework**: vitest

### Workflow

- Always ship tests with your code
- Always run `npm run format` before finishing to format your changes with Prettier
- Always run linters, tests and build scripts to validate your work
- Use Test Driven Development (TDD) until asked otherwise
- Prefer minimal, focused changes

### Build Process

```bash
npm install          # Install dependencies
npm run build        # Production build (minified)
npm run dev          # Development build with watch
npm test             # Run unit tests
npm run format      # Format code with Prettier
```

## Project Structure

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

## Architecture Notes

### Tasks Integration

The plugin integrates with the [Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) plugin via Obsidian's event system:

- **Events**: Listens to `obsidian-tasks-plugin:cache-update` for real-time task updates
- **Data Flow**: Tasks → Events → TasksIntegration → KanbanBoard → Columns → Cards
- **Status Update**: Uses TaskUpdater to modify task status in source files

### Drag & Drop

- **Implementation**: Native HTML5 Drag & Drop API
- **Data Transfer**: Uses custom data types (`application/task-id`, `application/task-path`)
- **Visual Feedback**: CSS classes for dragging/drop states
- **Status Update**: On drop, updates task status in source file → Tasks detects change → auto-refresh

### Kanban Columns

Default columns (configurable in `KanbanBoard.ts`):
- **Todo**: status symbol ` ` (space)
- **In Progress**: status symbol `/`
- **Done**: status symbol `x`

## Testing

### Unit Tests

Tests use Vitest with JSDom environment. Test files are in the `tests/` directory.

```bash
npm test        # Run all tests once
npm run test:watch  # Watch mode for development
```

### Manual Testing

1. Open Obsidian with Test vault
2. Enable Tasks and Tasks Kanban plugins
3. Create tasks with different statuses
4. Open Kanban board via command palette
5. Test drag & drop between columns
6. Verify status updates in source files

## Gotchas

- **Task ID Format**: Tasks plugin uses `^task-id` format for task identification
- **Status Symbols**: Tasks uses single character symbols for status (space, x, /, -, etc.)
- **File Access**: Use `app.vault.read()` and `app.vault.write()` for file operations
- **Event Timing**: Tasks may emit multiple cache-update events on startup
- **Duplicate Tasks**: Always deduplicate tasks by ID before processing
