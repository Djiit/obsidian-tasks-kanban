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
├── src/
│   ├── main.ts                      # Plugin entry point
│   ├── services/
│   │   ├── TasksIntegration.ts      # Integration with Tasks plugin (events)
│   │   └── TaskUpdater.ts           # Update task status in source files
│   ├── views/
│   │   └── TasksBoardView.ts         # Kanban view (ItemView)
│   ├── components/
│   │   ├── KanbanBoard.ts           # Board logic (distributes tasks)
│   │   ├── KanbanColumn.ts          # Column component (drop zone)
│   │   └── KanbanCard.ts            # Task card component (draggable)
│   └── filters/
│       └── TaskFilter.ts             # Task filtering (Tasks query syntax)
├── styles.css                      # Kanban board styles
├── manifest.json                   # Plugin manifest
├── package.json                    # Dependencies and scripts
├── tsconfig.json                   # TypeScript configuration
├── vitest.config.ts                # Vitest configuration
└── README.md                       # Project documentation
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

### Test Coverage

Current tests:
- TaskFilter: 12 tests covering tag, path, status, description, priority filtering

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

## Version History

- **0.1.0**: Initial MVP with display-only Kanban board
- **0.1.1**: Added drag & drop between columns
