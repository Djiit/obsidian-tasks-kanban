import { type Task } from "../services/TasksIntegration";
import { TasksIntegration } from "../services/TasksIntegration";
import { KanbanColumn } from "./KanbanColumn";
import type { KanbanColumnConfig } from "../utils/statusColumns";

/**
 * A single swimlane: an optional header (the group label) above a horizontal row
 * of {@link KanbanColumn}s. Tasks handed to {@link updateTasks} are distributed
 * across the lane's columns by status type — the board distributes across lanes,
 * the lane distributes across columns.
 *
 * When the lane has a label (i.e. grouping is active) the header doubles as a
 * fold toggle: clicking it collapses the lane to just its header. Column-fold
 * state is shared across all lanes (keyed by column id); both lane and column
 * toggles are reported up via callbacks so the board can persist them.
 */
export class KanbanLane {
  private root: HTMLElement;
  private columnsEl: HTMLElement;
  private columns: KanbanColumn[] = [];
  private collapsed: boolean;
  private readonly groupKey: string;
  private readonly onToggleGroup: (groupKey: string, collapsed: boolean) => void;

  constructor(
    container: HTMLElement,
    groupKey: string,
    label: string,
    columnConfigs: KanbanColumnConfig[],
    tasksIntegration: TasksIntegration,
    collapsedColumns: Set<string>,
    collapsed: boolean,
    onToggleColumn: (columnId: string, collapsed: boolean) => void,
    onToggleGroup: (groupKey: string, collapsed: boolean) => void,
  ) {
    this.groupKey = groupKey;
    this.collapsed = collapsed;
    this.onToggleGroup = onToggleGroup;

    this.root = container.createDiv({ cls: "tasks-kanban-lane" });

    // A label means grouping is active; only then is the lane foldable.
    if (label !== "") {
      const header = this.root.createDiv({ cls: "tasks-kanban-lane-header" });
      header.createSpan({
        cls: "tasks-kanban-lane-caret",
        text: "▾",
      });
      header.createSpan({ cls: "tasks-kanban-lane-title", text: label });
      header.addEventListener("click", () => this.toggleCollapsed());
    }

    this.columnsEl = this.root.createDiv({
      cls: "tasks-kanban-lane-columns",
    });

    for (const config of columnConfigs) {
      const columnEl = this.columnsEl.createDiv({ cls: "tasks-kanban-column" });
      const column = new KanbanColumn(
        columnEl,
        config,
        tasksIntegration,
        collapsedColumns.has(config.id),
        (columnCollapsed) => onToggleColumn(config.id, columnCollapsed),
      );
      this.columns.push(column);
    }

    this.applyCollapsed();
  }

  /** Distribute this lane's tasks across its columns by status type. */
  updateTasks(tasks: Task[]): void {
    for (const column of this.columns) {
      const statusTasks = tasks.filter(
        (task) => task.status.type === column.config.type,
      );
      column.updateTasks(statusTasks);
    }
  }

  destroy(): void {
    for (const column of this.columns) {
      column.destroy();
    }
    this.columns = [];
    this.root.remove();
  }

  /** Flip the fold state, update the DOM, and notify the board to persist. */
  private toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    this.applyCollapsed();
    this.onToggleGroup(this.groupKey, this.collapsed);
  }

  /** Reflect the current `collapsed` flag onto the DOM (styling lives in CSS:
   *  the lane class hides the columns body and rotates the caret). */
  private applyCollapsed(): void {
    this.root.toggleClass("tasks-kanban-lane-collapsed", this.collapsed);
    this.root.setAttribute("aria-expanded", this.collapsed ? "false" : "true");
  }
}
