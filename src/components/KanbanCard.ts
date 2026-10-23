import type { Task } from "../services/TasksIntegration";
import { TasksIntegration } from "../services/TasksIntegration";
import {
  getDateChips,
  getDependencyChips,
  getPriorityChip,
  stripTags,
  type Chip,
} from "../utils/taskChips";
import { Component, Keymap, MarkdownRenderer, setTooltip } from "obsidian";
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
  /** Owns whatever the Markdown renderer attaches to the description. */
  private renderComponent = new Component();

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
    const descEl = this.container.createDiv({
      cls: "tasks-kanban-card-description",
    });
    this.renderDescription(
      descEl,
      stripTags(this.task.description, this.task.tags),
    );

    // Footer: metadata chips (priority, dates, dependencies)
    this.renderChips();

    // Add drag start handler
    this.setupDragAndDrop();

    // A click opens the source file, unless it lands on a link in the description
    this.clickHandler = (event: MouseEvent) => {
      event.stopPropagation();
      const link = (event.target as HTMLElement | null)?.closest("a");
      if (link) {
        this.followLink(link, event);
        return;
      }
      this.openSourceFile();
    };
    this.container.addEventListener("click", this.clickHandler);
  }

  /**
   * Render the description as Markdown, the way the Tasks plugin renders task
   * descriptions, so links and inline styling show on the card. The height is
   * capped in CSS rather than by cutting the text, which could split Markdown
   * syntax such as a link.
   */
  private renderDescription(descEl: HTMLElement, markdown: string) {
    this.renderComponent.load();
    void MarkdownRenderer.render(
      this.app,
      markdown,
      descEl,
      this.task.taskLocation?.path ?? "",
      this.renderComponent,
    ).then(() => {
      // The renderer wraps inline text in a paragraph, whose margins would
      // pad the card.
      const paragraph = descEl.querySelector(":scope > p");
      if (paragraph && descEl.childElementCount === 1) {
        paragraph.replaceWith(...Array.from(paragraph.childNodes));
      }
      // A link is natively draggable and would otherwise drag its URL
      // instead of the card.
      descEl.querySelectorAll("a").forEach((link) => {
        link.setAttribute("draggable", "false");
      });
    });
  }

  /**
   * Follow a link clicked in the description. An internal link opens its note;
   * an external link is left to its default action, which opens the browser.
   */
  private followLink(link: HTMLAnchorElement, event: MouseEvent) {
    if (!link.classList.contains("internal-link")) return;

    event.preventDefault();
    const target = link.getAttribute("data-href") ?? link.getAttribute("href");
    if (!target) return;
    void this.app.workspace.openLinkText(
      target,
      this.task.taskLocation?.path ?? "",
      Keymap.isModEvent(event),
    );
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
   * Open the source file where this task is located, scrolling to and
   * placing the cursor on the task's line.
   */
  private openSourceFile() {
    const taskLocation = this.task.taskLocation;
    if (!taskLocation?.path || !this.app) return;

    const file = this.app.vault.getFileByPath(taskLocation.path);
    if (!file) return;

    void this.app.workspace.getLeaf().openFile(file, {
      eState: { line: taskLocation.lineNumber },
    });
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

    this.renderComponent.unload();
    this.container.remove();
  }

  /**
   * Get the task associated with this card
   */
  getTask(): Task {
    return this.task;
  }
}
