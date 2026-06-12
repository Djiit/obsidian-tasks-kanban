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
    this.container.setAttribute("data-status-type", this.config.type);

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
    if (!cardsContainer) return;

    // Drag over - add visual feedback
    this.dragOverHandler = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer!.dropEffect = "move";
      this.container.addClass("tasks-kanban-column-drag-over");
    };
    cardsContainer.addEventListener("dragover", this.dragOverHandler);

    // Drag enter
    this.dragEnterHandler = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.container.addClass("tasks-kanban-column-drag-over");
    };
    cardsContainer.addEventListener("dragenter", this.dragEnterHandler);

    // Drag leave
    this.dragLeaveHandler = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.container.removeClass("tasks-kanban-column-drag-over");
    };
    cardsContainer.addEventListener("dragleave", this.dragLeaveHandler);

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

      if (!task || task.status.type === this.config.type) {
        // Dropped into the column it already belongs to — no-op,
        // even if the symbol differs (e.g. a custom 'A' within In Progress).
        return;
      }

      void this.tasksIntegration.taskUpdater.updateTaskStatus(
        task,
        this.config.dropSymbol,
      );
    };
    cardsContainer.addEventListener("drop", this.dropHandler);
  }

  /**
   * Clean up the column
   */
  destroy() {
    if (this.dragOverHandler) {
      const cardsContainer = this.container.querySelector<HTMLElement>(
        ".tasks-kanban-column-cards",
      );
      if (cardsContainer) {
        cardsContainer.removeEventListener("dragover", this.dragOverHandler);
      }
      this.dragOverHandler = null;
    }

    if (this.dragEnterHandler) {
      const cardsContainer = this.container.querySelector<HTMLElement>(
        ".tasks-kanban-column-cards",
      );
      if (cardsContainer) {
        cardsContainer.removeEventListener("dragenter", this.dragEnterHandler);
      }
      this.dragEnterHandler = null;
    }

    if (this.dragLeaveHandler) {
      const cardsContainer = this.container.querySelector<HTMLElement>(
        ".tasks-kanban-column-cards",
      );
      if (cardsContainer) {
        cardsContainer.removeEventListener("dragleave", this.dragLeaveHandler);
      }
      this.dragLeaveHandler = null;
    }

    if (this.dropHandler) {
      const cardsContainer = this.container.querySelector<HTMLElement>(
        ".tasks-kanban-column-cards",
      );
      if (cardsContainer) {
        cardsContainer.removeEventListener("drop", this.dropHandler);
      }
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
