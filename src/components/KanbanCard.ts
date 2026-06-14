import type { Task } from "../services/TasksIntegration";
import { TasksIntegration } from "../services/TasksIntegration";
import { truncate } from "../utils/truncate";
import {
  getDateChips,
  getDependencyChips,
  getPriorityChip,
  stripTags,
  type Chip,
} from "../utils/taskChips";
import { setTooltip } from "obsidian";
import type { App } from "obsidian";

/**
 * The Kanban card component - represents a single task
 */
export class KanbanCard {
  private container: HTMLElement;
  private task: Task;
  private tasksIntegration: TasksIntegration;
  private app: App;
  private dragStartHandler: ((e: DragEvent) => void) | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;

  constructor(
    container: HTMLElement,
    task: Task,
    tasksIntegration: TasksIntegration,
  ) {
    this.container = container;
    this.task = task;
    this.tasksIntegration = tasksIntegration;
    this.app = tasksIntegration.app;
  }

  /**
   * Render the card
   */
  render() {
    this.container.empty();
    this.container.addClass("tasks-kanban-card");
    this.container.setAttribute("data-task-id", this.task.id);
    this.container.setAttribute(
      "data-task-path",
      this.task.taskLocation?.path || "",
    );
    this.container.setAttribute("draggable", "true");

    // Header: status + tags
    const headerEl = this.container.createDiv({
      cls: "tasks-kanban-card-header",
    });

    // Status indicator
    const statusEl = headerEl.createSpan({
      cls: "tasks-kanban-card-status",
    });
    statusEl.setText(this.task.status.symbol);
    statusEl.setAttribute("title", this.task.status.name);
    statusEl.setAttribute("data-status-type", this.task.status.type);

    // Tags
    if (this.task.tags && this.task.tags.length > 0) {
      const tagsEl = headerEl.createDiv({
        cls: "tasks-kanban-card-tags",
      });
      for (const tag of this.task.tags) {
        tagsEl.createSpan({
          cls: "tasks-kanban-card-tag",
          text: tag,
        });
      }
    }

    // Content: description
    const fullTitle = stripTags(this.task.description, this.task.tags);
    const descEl = this.container.createDiv({
      cls: "tasks-kanban-card-description",
    });
    const displayText = truncate(fullTitle);
    descEl.setText(displayText);
    if (displayText !== fullTitle) {
      descEl.setAttribute("title", fullTitle);
    }

    // Footer: metadata chips (priority, dates, dependencies)
    this.renderChips();

    // Add drag start handler
    this.setupDragAndDrop();

    // Add click handler to open the source file
    this.clickHandler = (event: MouseEvent) => {
      event.stopPropagation();
      this.openSourceFile();
    };
    this.container.addEventListener("click", this.clickHandler);
  }

  /**
   * Render the metadata chips row (priority, dates, dependencies). The row is
   * only created when there is at least one chip, so cards without metadata
   * don't gain an empty gap.
   */
  private renderChips() {
    const chips: Chip[] = [];

    const priority = getPriorityChip(this.task.priority);
    if (priority) {
      chips.push(priority);
    }

    chips.push(...getDateChips(this.task));

    const deps = getDependencyChips(
      this.task,
      this.tasksIntegration.getTasks(),
    );
    if (deps.blocked) chips.push(deps.blocked);
    if (deps.dependsOn) chips.push(deps.dependsOn);
    if (deps.id) chips.push(deps.id);

    if (chips.length === 0) {
      return;
    }

    const chipsEl = this.container.createDiv({
      cls: "tasks-kanban-card-chips",
    });
    for (const chip of chips) {
      const chipEl = chipsEl.createSpan({
        cls: [
          "tasks-kanban-card-chip",
          `tasks-kanban-card-chip-${chip.modifier}`,
        ],
        text: `${chip.emoji} ${chip.label}`,
      });
      if (chip.title) {
        setTooltip(chipEl, chip.title);
      }
    }
  }

  /**
   * Set up drag and drop for the card
   */
  private setupDragAndDrop() {
    this.dragStartHandler = (e: DragEvent) => {
      if (!e.dataTransfer) return;

      e.dataTransfer.setData("text/plain", this.task.description);
      e.dataTransfer.setData(
        "application/task-path",
        this.task.taskLocation?.path || "",
      );
      e.dataTransfer.setData(
        "application/task-line",
        String(this.task.taskLocation?.lineNumber ?? -1),
      );

      // Set the drag image (optional visual feedback)
      if (e.target) {
        e.dataTransfer.setDragImage(e.target as HTMLElement, 0, 0);
      }

      // Add visual feedback
      this.container.addClass("tasks-kanban-card-dragging");

      // Required for Firefox
      e.dataTransfer.effectAllowed = "move";
    };

    this.container.addEventListener("dragstart", this.dragStartHandler);

    // Clean up on drag end
    this.container.addEventListener("dragend", () => {
      this.container.removeClass("tasks-kanban-card-dragging");
    });
  }

  /**
   * Open the source file where this task is located
   */
  private openSourceFile() {
    const filePath = this.task.taskLocation?.path;
    if (filePath && this.app) {
      const file = this.app.vault.getFileByPath(filePath);
      if (file) {
        void this.app.workspace.getLeaf().openFile(file);
      }
    }
  }

  /**
   * Clean up the card
   */
  destroy() {
    if (this.dragStartHandler) {
      this.container.removeEventListener("dragstart", this.dragStartHandler);
      this.dragStartHandler = null;
    }

    this.container.removeEventListener("dragend", () => {});

    if (this.clickHandler) {
      this.container.removeEventListener("click", this.clickHandler);
      this.clickHandler = null;
    }

    this.container.remove();
  }

  /**
   * Get the task associated with this card
   */
  getTask(): Task {
    return this.task;
  }
}
