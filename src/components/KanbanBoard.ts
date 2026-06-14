import { setIcon, type App } from "obsidian";

import type { Task } from "../services/TasksIntegration";
import { TasksIntegration } from "../services/TasksIntegration";
import { KanbanColumn } from "./KanbanColumn";
import { SearchBar } from "./SearchBar";
import { SortBar } from "./SortBar";
import { QueryModal } from "./QueryModal";
import { buildColumns } from "../utils/statusColumns";
import { getUniqueTags } from "../utils/searchFilter";
import {
  applyBoardQuery,
  getSort,
  getTags,
  getTitle,
  parseQuery,
  serializeQuery,
  withSort,
  withTags,
  withTitle,
  type BoardQuery,
} from "../query/boardQuery";
import type { BoardStatePersistence } from "../types/persistence";

export type { KanbanColumnConfig } from "../utils/statusColumns";

/**
 * The Kanban board component
 */
export class KanbanBoard {
  private container: HTMLElement;
  private app: App;
  private boardEl!: HTMLElement;
  private tasksIntegration: TasksIntegration;
  private columns: KanbanColumn[] = [];
  private searchBar: SearchBar;
  private sortBar: SortBar;
  private persistence: BoardStatePersistence;
  /** Source of truth: every task last received, before query filtering. */
  private allTasks: Task[] = [];
  /** The tasks currently displayed (after the query's filtering and sorting). */
  private tasks: Task[] = [];
  /** The canonical board query: filters + sort. Bars edit slices of it. */
  private boardQuery: BoardQuery;
  /** Column IDs currently folded; persisted across reopens. */
  private collapsedColumns: Set<string>;

  constructor(
    container: HTMLElement,
    app: App,
    tasksIntegration: TasksIntegration,
    persistence: BoardStatePersistence,
  ) {
    this.container = container;
    this.app = app;
    this.tasksIntegration = tasksIntegration;
    this.persistence = persistence;

    // Hydrate the canonical query from the persisted query string.
    const initial = persistence.get();
    this.boardQuery = parseQuery(initial.query).query;
    this.collapsedColumns = new Set(initial.collapsedColumns);

    // Search, sort, and query-edit controls sit above the board in a shared row.
    const header = this.container.createDiv({ cls: "tasks-kanban-header" });
    this.searchBar = new SearchBar(
      header,
      (state) => {
        this.boardQuery = withTitle(
          withTags(this.boardQuery, state.selectedTags),
          state.titleQuery,
        );
        this.persistState();
        this.applyQuery();
      },
      getTags(this.boardQuery),
    );
    // Seed the title input from the query (description slice).
    this.searchBar.setState({
      titleQuery: getTitle(this.boardQuery),
      selectedTags: getTags(this.boardQuery),
    });
    this.sortBar = new SortBar(
      header,
      (state) => {
        this.boardQuery = withSort(this.boardQuery, state);
        this.persistState();
        this.applyQuery();
      },
      getSort(this.boardQuery),
    );

    this.createQueryButton(header);

    // Initialize default columns (into their own board sub-element)
    this.initColumns();
  }

  /**
   * Add the "Edit query" header button that opens the raw-query modal.
   */
  private createQueryButton(header: HTMLElement) {
    const button = header.createEl("button", {
      cls: "tasks-kanban-query-button",
      attr: { type: "button", "aria-label": "Edit query" },
    });
    setIcon(button, "filter");
    button.addEventListener("click", () => this.openQueryModal());
  }

  /**
   * Open the query modal, then push the edited query into the bars and re-render.
   */
  private openQueryModal() {
    new QueryModal(this.app, this.boardQuery, (query) => {
      this.boardQuery = query;
      this.searchBar.setState({
        titleQuery: getTitle(query),
        selectedTags: getTags(query),
      });
      this.sortBar.setState(getSort(query));
      this.persistState();
      this.applyQuery();
    }).open();
  }

  /**
   * Persist the slice of state that survives reopens: the canonical query string
   * and the set of folded columns.
   */
  private persistState() {
    void this.persistence.save({
      query: serializeQuery(this.boardQuery),
      collapsedColumns: [...this.collapsedColumns],
    });
  }

  /**
   * Initialize columns derived from the vault's configured statuses
   */
  private initColumns() {
    this.boardEl = this.container.createDiv({ cls: "tasks-kanban-board" });

    const columnConfigs = buildColumns(this.tasksIntegration.getStatuses());
    for (const config of columnConfigs) {
      const columnEl = this.boardEl.createDiv({
        cls: "tasks-kanban-column",
      });
      const column = new KanbanColumn(
        columnEl,
        config,
        this.tasksIntegration,
        this.collapsedColumns.has(config.id),
        (collapsed) => {
          if (collapsed) {
            this.collapsedColumns.add(config.id);
          } else {
            this.collapsedColumns.delete(config.id);
          }
          this.persistState();
        },
      );
      this.columns.push(column);
    }
  }

  /**
   * Render the board with current tasks
   */
  render() {
    this.updateTasks(this.allTasks);
  }

  /**
   * Update tasks and redistribute across columns
   */
  updateTasks(tasks: Task[]) {
    // Remove duplicates by ID
    this.allTasks = this.removeDuplicateTasks(tasks);
    this.searchBar.setTags(getUniqueTags(this.allTasks));
    this.applyQuery();
  }

  /**
   * Remove duplicate tasks based on ID
   */
  private removeDuplicateTasks(tasks: Task[]): Task[] {
    const seenIds = new Set<string>();
    return tasks.filter((task) => {
      const id = task.id || task.originalMarkdown;
      if (seenIds.has(id)) {
        return false;
      }
      seenIds.add(id);
      return true;
    });
  }

  /**
   * Reload the query from persistence and re-apply it.
   */
  reloadQueryFromPersistence(): void {
    const state = this.persistence.get();
    this.boardQuery = parseQuery(state.query).query;
    this.collapsedColumns = new Set(state.collapsedColumns);
    this.searchBar.setState({
      titleQuery: getTitle(this.boardQuery),
      selectedTags: getTags(this.boardQuery),
    });
    this.sortBar.setState(getSort(this.boardQuery));
    this.applyQuery();
  }

  /**
   * Apply the canonical query (filter + sort) to the source tasks and re-render.
   */
  private applyQuery() {
    this.tasks = applyBoardQuery(this.allTasks, this.boardQuery);
    this.distributeTasks();
  }

  /**
   * Distribute tasks across columns based on their status
   */
  private distributeTasks() {
    for (const column of this.columns) {
      const statusTasks = this.tasks.filter(
        (task) => task.status.type === column.config.type,
      );
      column.updateTasks(statusTasks);
    }
  }

  /**
   * Clean up the board
   */
  destroy() {
    this.searchBar.destroy();
    this.sortBar.destroy();
    for (const column of this.columns) {
      column.destroy();
    }
    this.columns = [];
  }
}
