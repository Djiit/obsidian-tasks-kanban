import { setIcon, type App } from "obsidian";

import type { Task } from "../services/TasksIntegration";
import { TasksIntegration } from "../services/TasksIntegration";
import { KanbanLane } from "./KanbanLane";
import { SearchBar } from "./SearchBar";
import { SortBar } from "./SortBar";
import { GroupBar } from "./GroupBar";
import { QueryModal } from "./QueryModal";
import { resolveColumns } from "../utils/statusColumns";
import { getUniqueTags } from "../utils/searchFilter";
import { groupTasks, type TaskGroup } from "../utils/groupTasks";
import {
  applyBoardQuery,
  getExcludedTags,
  getGroup,
  getSort,
  getTags,
  getTitle,
  mergeQueries,
  parseQuery,
  serializeQuery,
  withExcludedTags,
  withGroup,
  withSort,
  withTags,
  withTitle,
  type BoardQuery,
} from "../query/boardQuery";
import type { BoardStatePersistence, ColumnConfig } from "../types/persistence";

export type { KanbanColumnConfig } from "../utils/statusColumns";

/**
 * The Kanban board component
 */
export class KanbanBoard {
  private container: HTMLElement;
  private app: App;
  private boardEl!: HTMLElement;
  private tasksIntegration: TasksIntegration;
  private lanes: KanbanLane[] = [];
  /** Group keys currently rendered, parallel to {@link lanes}; for reconcile. */
  private laneKeys: string[] = [];
  private searchBar: SearchBar;
  private sortBar: SortBar;
  private groupBar: GroupBar;
  private persistence: BoardStatePersistence;
  /** Source of truth: every task last received, before query filtering. */
  private allTasks: Task[] = [];
  /** The canonical board query: filters + sort + group. Bars edit slices of it. */
  private boardQuery: BoardQuery;
  /** Shared base query merged on top of {@link boardQuery} at render time. */
  private baseQuery: BoardQuery;
  /** Column IDs currently folded; persisted across reopens. */
  private collapsedColumns: Set<string>;
  /** Group keys (swimlane keys) currently folded; persisted across reopens. */
  private collapsedGroups: Set<string>;
  /** Custom columns for this board; empty ⇒ default status columns. */
  private columnConfigs: ColumnConfig[];

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
    this.baseQuery = parseQuery(persistence.getBaseQuery()).query;
    this.collapsedColumns = new Set(initial.collapsedColumns);
    this.collapsedGroups = new Set(initial.collapsedGroups);
    this.columnConfigs = initial.columns;

    // Search, sort, and query-edit controls sit above the board in a shared row.
    const header = this.container.createDiv({ cls: "tasks-kanban-header" });
    this.searchBar = new SearchBar(
      header,
      (state) => {
        this.boardQuery = withTitle(
          withTags(
            withExcludedTags(this.boardQuery, state.excludedTags ?? []),
            state.selectedTags,
          ),
          state.titleQuery,
        );
        this.persistState();
        this.applyQuery();
      },
      getTags(this.boardQuery),
      getExcludedTags(this.boardQuery),
    );
    // Seed the title input from the query (description slice).
    this.searchBar.setState({
      titleQuery: getTitle(this.boardQuery),
      selectedTags: getTags(this.boardQuery),
      excludedTags: getExcludedTags(this.boardQuery),
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
    this.groupBar = new GroupBar(
      header,
      (state) => {
        this.boardQuery = withGroup(this.boardQuery, state);
        this.persistState();
        this.applyQuery();
      },
      getGroup(this.boardQuery),
    );

    this.createQueryButton(header);

    // The lanes render into their own board sub-element.
    this.boardEl = this.container.createDiv({ cls: "tasks-kanban-board" });
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
        excludedTags: getExcludedTags(query),
      });
      this.sortBar.setState(getSort(query));
      this.groupBar.setState(getGroup(query));
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
      collapsedGroups: [...this.collapsedGroups],
      columns: this.columnConfigs,
    });
  }

  /**
   * Fold/unfold a column across every lane and persist. The collapsed set is
   * keyed by column id, so the change applies to that column in all lanes.
   */
  private toggleColumn(columnId: string, collapsed: boolean) {
    if (collapsed) {
      this.collapsedColumns.add(columnId);
    } else {
      this.collapsedColumns.delete(columnId);
    }
    // Apply to the same column in every other lane so folding is board-wide.
    for (const lane of this.lanes) {
      lane.setColumnCollapsed(columnId, collapsed);
    }
    this.persistState();
  }

  /** Fold/unfold a swimlane (by group key) and persist. */
  private toggleGroup(groupKey: string, collapsed: boolean) {
    if (collapsed) {
      this.collapsedGroups.add(groupKey);
    } else {
      this.collapsedGroups.delete(groupKey);
    }
    this.persistState();
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
    this.baseQuery = parseQuery(this.persistence.getBaseQuery()).query;
    this.collapsedColumns = new Set(state.collapsedColumns);
    this.collapsedGroups = new Set(state.collapsedGroups);
    this.columnConfigs = state.columns;
    this.searchBar.setState({
      titleQuery: getTitle(this.boardQuery),
      selectedTags: getTags(this.boardQuery),
      excludedTags: getExcludedTags(this.boardQuery),
    });
    this.sortBar.setState(getSort(this.boardQuery));
    this.groupBar.setState(getGroup(this.boardQuery));
    this.applyQuery();
  }

  /**
   * Apply the canonical query (filter + sort), split into swimlanes by the group
   * slice, and render. Grouping runs after filter+sort, mirroring Tasks.
   */
  private applyQuery() {
    const merged = mergeQueries(this.baseQuery, this.boardQuery);
    const ordered = applyBoardQuery(this.allTasks, merged);
    const groups = groupTasks(ordered, merged.group);
    // When grouping is active the board is a vertical stack of content-sized
    // lanes; when off it is a single lane that fills the height (today's layout).
    this.boardEl.toggleClass(
      "tasks-kanban-board-grouped",
      merged.group.field !== "none",
    );
    this.renderLanes(groups);
  }

  /**
   * Reconcile the rendered lanes with the given groups. We rebuild the lanes
   * when either the ordered group keys or the resolved column set change;
   * otherwise we keep the lanes and just refresh their tasks (lanes are cheap and
   * these structural changes are infrequent). The column set is folded into the
   * lane signature so editing custom columns (which doesn't change group keys)
   * still re-renders.
   */
  private renderLanes(groups: TaskGroup[]) {
    const columnConfigs = resolveColumns(
      this.columnConfigs,
      this.tasksIntegration.getStatuses(),
    );
    const columnSignature = columnConfigs
      .map((c) => `${c.id}:${c.symbols.join("")}`)
      .join("|");
    const keys = groups.map((g) => `${columnSignature}#${g.key}`);
    const sameLanes =
      keys.length === this.laneKeys.length &&
      keys.every((key, i) => key === this.laneKeys[i]);

    if (!sameLanes) {
      for (const lane of this.lanes) {
        lane.destroy();
      }
      this.lanes = [];
      for (const group of groups) {
        this.lanes.push(
          new KanbanLane(
            this.boardEl,
            group.key,
            group.label,
            columnConfigs,
            this.tasksIntegration,
            this.collapsedColumns,
            this.collapsedGroups.has(group.key),
            (columnId, collapsed) => this.toggleColumn(columnId, collapsed),
            (groupKey, collapsed) => this.toggleGroup(groupKey, collapsed),
          ),
        );
      }
      this.laneKeys = keys;
    }

    groups.forEach((group, i) => this.lanes[i].updateTasks(group.tasks));
  }

  /**
   * Clean up the board
   */
  destroy() {
    this.searchBar.destroy();
    this.sortBar.destroy();
    this.groupBar.destroy();
    for (const lane of this.lanes) {
      lane.destroy();
    }
    this.lanes = [];
    this.laneKeys = [];
  }
}
