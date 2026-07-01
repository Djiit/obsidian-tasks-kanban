import type { Task } from "../services/TasksIntegration";
import { TasksIntegration } from "../services/TasksIntegration";
import { KanbanCard } from "./KanbanCard";
import type { KanbanColumnConfig } from "../utils/statusColumns";

/**
 * The Kanban column component
 */
export class KanbanColumn {
  private container: HTMLElement;
  readonly config: KanbanColumnConfig;
  private tasksIntegration: TasksIntegration;
  private cards: KanbanCard[] = [];
  private dragOverHandler: ((e: DragEvent) => void) | null = null;
  private dragLeaveHandler: ((e: DragEvent) => void) | null = null;
  private dropHandler: ((e: DragEvent) => void) | null = null;
  private dragEnterHandler: ((e: DragEvent) => void) | null = null;
  private collapsed: boolean;
  private onToggleCollapse?: (collapsed: boolean) => void;
  private headerClickHandler: ((e: MouseEvent) => void) | null = null;

  constructor(
    container: HTMLElement,
    config: KanbanColumnConfig,
    tasksIntegration: TasksIntegration,
    collapsed = false,
    onToggleCollapse?: (collapsed: boolean) => void,
  ) {
    this.container = container;
    this.config = config;
    this.tasksIntegration = tasksIntegration;
    this.collapsed = collapsed;
    this.onToggleCollapse = onToggleCollapse;

    this.init();
    this.setupDragAndDrop();
  }

  /**
   * Initialize the column
   */
  private init() {
    this.container.empty();
    this.container.addClass("tasks-kanban-column");

    // Create header. Clicking it folds/unfolds the column.
    const header = this.container.createDiv({
      cls: "tasks-kanban-column-header",
    });

    // Fold caret (rotates via CSS depending on collapsed state)
    header.createSpan({
      cls: "tasks-kanban-column-caret",
      text: "▾",
    });

    header.createSpan({
      cls: "tasks-kanban-column-title",
      text: this.config.title,
    });

    // Create count badge
    const countBadge = header.createSpan({
      cls: "tasks-kanban-column-count",
    });
    countBadge.setText("0");

    // Create cards container
    this.container.createDiv({
      cls: "tasks-kanban-column-cards",
    });

    // Store references
    this.container.setAttribute("data-column-id", this.config.id);

    // Apply the initial fold state and make the header a toggle.
    this.applyCollapsed();
    this.headerClickHandler = () => this.toggleCollapsed();
    header.addEventListener("click", this.headerClickHandler);
  }

  /**
   * Reflect the current `collapsed` flag onto the DOM. The narrow-strip
   * styling and the rotated title live entirely in CSS, keyed off this class.
   */
  private applyCollapsed() {
    this.container.toggleClass("tasks-kanban-column-collapsed", this.collapsed);
    this.container.setAttribute(
      "aria-expanded",
      this.collapsed ? "false" : "true",
    );
  }

  /** Flip the fold state, update the DOM, and notify the board to persist. */
  private toggleCollapsed() {
    this.collapsed = !this.collapsed;
    this.applyCollapsed();
    this.onToggleCollapse?.(this.collapsed);
  }

  /**
   * Set the fold state from outside (e.g. the board syncing every lane after one
   * column is toggled) without firing the toggle callback — avoids feedback loops.
   */
  setCollapsed(collapsed: boolean) {
    if (this.collapsed === collapsed) {
      return;
    }
    this.collapsed = collapsed;
    this.applyCollapsed();
  }

  /**
   * Update tasks in this column
   */
  updateTasks(tasks: Task[]) {
    // Clear existing cards
    for (const card of this.cards) {
      card.destroy();
    }
    this.cards = [];

    // Update count
    const countBadge = this.container.querySelector(
      ".tasks-kanban-column-count",
    );
    if (countBadge) {
      countBadge.setText(String(tasks.length));
    }

    // Create new cards
    const cardsContainer = this.container.querySelector<HTMLElement>(
      ".tasks-kanban-column-cards",
    );
    if (!cardsContainer) return;

    for (const task of tasks) {
      const cardEl = cardsContainer.createDiv({
        cls: "tasks-kanban-card",
      });
      const card = new KanbanCard(cardEl, task, this.tasksIntegration);
      this.cards.push(card);
      card.render();
    }
  }

  /**
   * Set up drag and drop for the column
   */
  private setupDragAndDrop() {
    const cardsContainer = this.container.querySelector<HTMLElement>(
      ".tasks-kanban-column-cards",
    );

    // Drag over - add visual feedback
    this.dragOverHandler = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer!.dropEffect = "move";
      this.container.addClass("tasks-kanban-column-drag-over");
    };

    // Drag enter
    this.dragEnterHandler = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.container.addClass("tasks-kanban-column-drag-over");
    };

    // Drag leave
    this.dragLeaveHandler = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.container.removeClass("tasks-kanban-column-drag-over");
    };

    // Drop - handle the task status change
    this.dropHandler = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.container.removeClass("tasks-kanban-column-drag-over");

      const taskPath = e.dataTransfer?.getData("application/task-path");
      const taskLine = e.dataTransfer?.getData("application/task-line");

      if (!taskPath || !taskLine) {
        return;
      }

      const lineNumber = Number(taskLine);
      const allTasks = this.tasksIntegration.getTasks();
      const task = allTasks.find(
        (t) =>
          t.taskLocation?.path === taskPath &&
          t.taskLocation?.lineNumber === lineNumber,
      );

      if (!task || this.config.symbols.includes(task.status.symbol)) {
        // Dropped into the column it already belongs to (its symbol is one this
        // column collects) — no-op. Otherwise write the column's drop symbol,
        // which may change the task within a status type (e.g. '/' → 'A').
        return;
      }

      void this.tasksIntegration.taskUpdater.updateTaskStatus(
        task,
        this.config.dropSymbol,
      );
    };

    // Attach handlers to cards container (receives events when expanded)
    if (cardsContainer) {
      cardsContainer.addEventListener("dragover", this.dragOverHandler);
      cardsContainer.addEventListener("dragenter", this.dragEnterHandler);
      cardsContainer.addEventListener("dragleave", this.dragLeaveHandler);
      cardsContainer.addEventListener("drop", this.dropHandler);
    }

    // Also attach to header so collapsed columns still accept drops.
    // When the column is collapsed the cards container is display:none and
    // cannot receive pointer/drag events, so the header becomes the drop zone.
    const header = this.container.querySelector<HTMLElement>(
      ".tasks-kanban-column-header",
    );
    if (header) {
      header.addEventListener("dragover", this.dragOverHandler);
      header.addEventListener("dragenter", this.dragEnterHandler);
      header.addEventListener("dragleave", this.dragLeaveHandler);
      header.addEventListener("drop", this.dropHandler);
    }
  }

  /**
   * Clean up the column
   */
  destroy() {
    const removeFromTargets = (handler: (e: DragEvent) => void) => {
      const cardsContainer = this.container.querySelector<HTMLElement>(
        ".tasks-kanban-column-cards",
      );
      if (cardsContainer) {
        cardsContainer.removeEventListener("dragover", handler);
        cardsContainer.removeEventListener("dragenter", handler);
        cardsContainer.removeEventListener("dragleave", handler);
        cardsContainer.removeEventListener("drop", handler);
      }
      const header = this.container.querySelector<HTMLElement>(
        ".tasks-kanban-column-header",
      );
      if (header) {
        header.removeEventListener("dragover", handler);
        header.removeEventListener("dragenter", handler);
        header.removeEventListener("dragleave", handler);
        header.removeEventListener("drop", handler);
      }
    };

    if (this.dragOverHandler) {
      removeFromTargets(this.dragOverHandler);
      this.dragOverHandler = null;
    }

    if (this.dragEnterHandler) {
      removeFromTargets(this.dragEnterHandler);
      this.dragEnterHandler = null;
    }

    if (this.dragLeaveHandler) {
      removeFromTargets(this.dragLeaveHandler);
      this.dragLeaveHandler = null;
    }

    if (this.dropHandler) {
      removeFromTargets(this.dropHandler);
      this.dropHandler = null;
    }

    if (this.headerClickHandler) {
      const header = this.container.querySelector<HTMLElement>(
        ".tasks-kanban-column-header",
      );
      if (header) {
        header.removeEventListener("click", this.headerClickHandler);
      }
      this.headerClickHandler = null;
    }

    for (const card of this.cards) {
      card.destroy();
    }
    this.cards = [];
  }
}
