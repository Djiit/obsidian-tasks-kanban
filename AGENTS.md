# AGENTS.md - Obsidian Tasks Kanban Plugin

## About the Project

**Name**: Obsidian Tasks Kanban
**Description**: Kanban board view plugin for Obsidian that displays Tasks in a visual board layout with drag & drop support.

## Agent Toolchain

Validated harness for autonomous work on this repo: run the checks, reproduce in
the test vault, verify visually in Obsidian, ship a PR.

| Layer | Tool | Notes |
|---|---|---|
| Unit tests | `npm test` (Vitest, JSDom) | 326 tests, 14 files, ~1s |
| Typecheck | `npm run typecheck` | |
| Lint | `npm run lint` (ESLint + eslint-plugin-obsidianmd) | |
| Build | `npm run build:dev` | ~105kb bundle, also symlinks plugin into vault |
| Format | `npm run format` (Prettier) | Run before finishing |
| Obsidian CLI | `obsidian` (`obsidian help`) | v1.14.4+; vault read/write, `plugin:reload` |
| GUI control | Computer Use MCP (`tools.mcp_computer_use.*`) | AX tree + screenshot + click/drag/scroll |
| GitHub | `gh` CLI | Issues, PRs, `--attach` screenshots |

Node 26 / npm 12 via mise. Obsidian must be running and the vault open for CLI
vault-scoped commands to respond.

## Standard issue workflow

1. **Triage**: `gh issue list --repo Djiit/obsidian-tasks-kanban --state open`,
   then `gh issue view <n>` for the report.
2. **Reproduce/fix**: TDD — write failing test in `tests/`, implement in `src/`,
   `npm test`.
3. **Full checks**: `npm run lint && npm test && npm run typecheck && npm run build:dev`.
4. **Visual verify** in the test vault (see below).
5. **PR**: draft PR, reference the issue (`Closes #n`), attach a screenshot via
   `gh pr create --attach PATH/TO/SHOT.png` for UI changes. Conventional Commits.

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
- Always run linters, the typecheck, tests and build scripts to validate your work
- Use Test Driven Development (TDD) until asked otherwise
- Prefer minimal, focused changes
- Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/) (enforced by commitlint)

### Git Hooks

Husky runs checks automatically (installed via the `prepare` script on `npm install`):

- **pre-commit**: `lint-staged` (ESLint `--fix` + Prettier on staged files) then `npm run typecheck`
- **commit-msg**: `commitlint` validates the message against Conventional Commits

### Build Process

```bash
npm install          # Install dependencies
npm run build        # Production build (minified)
npm run dev          # Development build with watch
npm test             # Run unit tests
npm run typecheck    # Type-check with tsc (no emit)
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

### Visual Testing in the Test Vault

The `test-vault/` is a purpose-built fixture vault (see
`test-vault/00 - README.md` for the per-file edge-case catalog). The build
symlinks `main.js`, `manifest.json`, `styles.css` into
`test-vault/.obsidian/plugins/tasks-kanban/`, so the vault always runs the
current build.

Fast loop while Obsidian has the vault open:

```bash
npm run build:dev          # rebuild + relink
npm run dev:reload         # obsidian plugin:reload id=tasks-kanban
```

Then inspect the board with Computer Use:

```
get_app_state(app: 'Obsidian')            # screenshot + AX tree of key window
query(app: 'Obsidian', text: 'Todo')      # targeted lookup; returns clickable indexes
click(app: 'Obsidian', element_index: N)  # click by AX element or pixel coords
```

Practical notes:

- The AX tree exposes the full board: column headers with counts
  (`Todo 12`, `Done 40`, `Cancelled 24`), every card as a button with its
  description and metadata chips. Assertions like "column X shows task Y" are
  answerable from the tree alone, no screenshot reading needed.
- Give `query` a generous `max_nodes` (1500-3000) — boards with the Volume
  fixture exceed the default 500 and return zero matches, which looks like a
  missing element but is not.
- `get_app_state` with `window_placement: 'agent_display'` parks the window off
  the user's desktop if you need to work without disturbing them.
- Screenshots come back in the tool result for attaching to PRs.
- **Capture screenshots while the fixture is still in place.** Order matters:
  verify the board state (AX tree), capture, then clean up the fixture files.
  Capturing after cleanup records an empty board — the board state is the
  evidence, and it cannot be recreated later without redoing the setup.
- The QueryModal textarea does not submit on Enter; after `set_value`, click
  the **Save** button (`query(app, text: 'Save')` → `click`). `Cancel` closes
  without applying.

## Gotchas

- **Task ID Format**: Tasks plugin uses `^task-id` format for task identification
- **Status Symbols**: Tasks uses single character symbols for status (space, x, /, -, etc.)
- **File Access**: Use `app.vault.read()` and `app.vault.write()` for file operations
- **Event Timing**: Tasks may emit multiple cache-update events on startup
- **Duplicate Tasks**: Always deduplicate tasks by ID before processing
- **Vault Registry vs Worktrees**: `obsidian vaults` resolves "test-vault" from
  `~/Library/Application Support/obsidian/obsidian.json`, whose path entry points
  at whichever checkout registered the vault — not necessarily the active
  worktree. In a worktree session: quit Obsidian (`osascript -e 'quit app "Obsidian"'`
  — the running app keeps the registry in memory and ignores edits), repoint the
  vault entry to the worktree path (keep a backup), then
  `open -a Obsidian "<worktree>/test-vault"` — the app re-reads the registry on
  launch. **Restore the original `obsidian.json` before finishing.** Opening the
  vault directly by path also works, but then you may be testing another
  checkout's build; for issue work, repoint the registry so the vault runs the
  worktree's `main.js`.
