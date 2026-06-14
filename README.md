# Obsidian Tasks Kanban

A Kanban board view plugin for Obsidian that displays Tasks in a visual board layout.

> [!NOTE]
> **Why this and not another Kanban plugin?**
> The key difference is *what a card is*:
>
> | Plugin | Cards are… | Built on |
> |--------|------------|----------|
> | [Kanban](https://github.com/mgmeyers/obsidian-kanban) | **notes** — a board is its own note, each card a line of Markdown living only on that board | self-contained board note |
> | [Kanban Bases View](https://community.obsidian.md/plugins/kanban-bases-view) | **notes** — one card per note, columns from a frontmatter/Base property | [Obsidian Bases](https://help.obsidian.md/bases) |
> | **Tasks Kanban** (this) | **tasks** — cards *are* your real tasks, wherever they already live in your vault | [Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) |
>
> Because this plugin is built on Tasks, the board is a **live view over your existing tasks** (filtered, sorted, grouped) rather than a separate copy to keep in sync. Move a card and it rewrites the task's status in its source file. Choose this if your work already lives as `- [ ]` tasks scattered across your notes; choose a note-based board if you'd rather each card be a whole note.

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

### Building

```bash
# Install dependencies
npm install

# Build for production (minified)
npm run build
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

### Type Checking

```bash
npm run typecheck   # Type-check without emitting output
```

### Git Hooks

[Husky](https://typicode.github.io/husky/) hooks are installed automatically on
`npm install` (via the `prepare` script):

- **pre-commit**: runs `lint-staged` (ESLint + Prettier on staged files) followed
  by `npm run typecheck`.
- **commit-msg**: validates the message with [commitlint](https://commitlint.js.org/)
  against the [Conventional Commits](https://www.conventionalcommits.org/) spec.

## License

MIT
