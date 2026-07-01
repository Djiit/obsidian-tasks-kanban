import { describe, it, expect, vi, beforeEach } from "vitest";
import { KanbanColumn } from "../src/components/KanbanColumn";
import type { KanbanColumnConfig } from "../src/utils/statusColumns";
import type { Task } from "../src/services/TasksIntegration";

// Minimal DataTransfer polyfill for JSDom (which lacks it).
class StubDataTransfer {
  private data = new Map<string, string>();
  dropEffect: DataTransfer["dropEffect"] = "move";
  effectAllowed: DataTransfer["effectAllowed"] = "move";
  setData(format: string, data: string) {
    this.data.set(format, data);
  }
  getData(format: string) {
    return this.data.get(format) ?? "";
  }
  clearData(format?: string) {
    if (format) this.data.delete(format);
    else this.data.clear();
  }
  get types() {
    return Array.from(this.data.keys());
  }
  get files() {
    return [] as File[];
  }
  get items() {
    return [] as DataTransferItemList;
  }
}

/** Create a DragEvent-like event with the given type and optional data. */
function dragEvent(type: string, dt?: StubDataTransfer): Event {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  // Always attach a dataTransfer so the handler can set dropEffect without
  // crashing. Use the explicit stub when provided, otherwise an empty one.
  Object.defineProperty(ev, "dataTransfer", {
    value: dt ?? new StubDataTransfer(),
    writable: false,
  });
  return ev;
}

function stubDataTransfer(entries: Record<string, string>): StubDataTransfer {
  const dt = new StubDataTransfer();
  for (const [key, value] of Object.entries(entries)) {
    dt.setData(key, value);
  }
  return dt;
}

const todoConfig: KanbanColumnConfig = {
  id: "todo",
  title: "Todo",
  symbols: [" "],
  dropSymbol: " ",
};

const TODO_TASK: Task = {
  id: "t1",
  status: { symbol: " ", name: "Todo", type: "TODO" },
  description: "A todo task",
  tags: [],
  priority: null,
  dueDate: null,
  startDate: null,
  scheduledDate: null,
  doneDate: null,
  createdDate: null,
  cancelledDate: null,
  recurrence: null,
  dependsOn: [],
  taskLocation: { path: "notes.md", lineNumber: 3 },
  originalMarkdown: "- [ ] A todo task",
};

const DONE_TASK: Task = {
  id: "t2",
  status: { symbol: "x", name: "Done", type: "DONE" },
  description: "A done task",
  tags: [],
  priority: null,
  dueDate: null,
  startDate: null,
  scheduledDate: null,
  doneDate: null,
  createdDate: null,
  cancelledDate: null,
  recurrence: null,
  dependsOn: [],
  taskLocation: { path: "notes.md", lineNumber: 5 },
  originalMarkdown: "- [x] A done task",
};

function mockIntegration(tasks: Task[]) {
  const taskUpdater = { updateTaskStatus: vi.fn().mockResolvedValue(true) };
  return {
    getTasks: vi.fn().mockReturnValue(tasks),
    taskUpdater,
    app: {},
  };
}

describe("KanbanColumn", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  // ── Expanded: drag events on the cards container ──────────────

  describe("drag events (expanded)", () => {
    it("adds drag-over class on dragover over cards container", () => {
      const col = new KanbanColumn(
        container,
        todoConfig,
        mockIntegration([]) as any,
        false,
      );
      const cards = container.querySelector<HTMLElement>(
        ".tasks-kanban-column-cards",
      )!;
      cards.dispatchEvent(dragEvent("dragover"));
      expect(
        container.classList.contains("tasks-kanban-column-drag-over"),
      ).toBe(true);
      col.destroy();
    });

    it("removes drag-over class on dragleave from cards container", () => {
      const col = new KanbanColumn(
        container,
        todoConfig,
        mockIntegration([]) as any,
        false,
      );
      const cards = container.querySelector<HTMLElement>(
        ".tasks-kanban-column-cards",
      )!;
      cards.dispatchEvent(dragEvent("dragover"));
      cards.dispatchEvent(dragEvent("dragleave"));
      expect(
        container.classList.contains("tasks-kanban-column-drag-over"),
      ).toBe(false);
      col.destroy();
    });

    it("calls updateTaskStatus on drop with valid task data", () => {
      const integration = mockIntegration([DONE_TASK]);
      const col = new KanbanColumn(
        container,
        todoConfig,
        integration as any,
        false,
      );
      const cards = container.querySelector<HTMLElement>(
        ".tasks-kanban-column-cards",
      )!;
      const dt = stubDataTransfer({
        "application/task-path": "notes.md",
        "application/task-line": "5",
      });
      cards.dispatchEvent(dragEvent("drop", dt));
      expect(integration.taskUpdater.updateTaskStatus).toHaveBeenCalledWith(
        DONE_TASK,
        " ",
      );
      col.destroy();
    });

    it("does not call updateTaskStatus when task already belongs to this column", () => {
      const integration = mockIntegration([TODO_TASK]);
      const col = new KanbanColumn(
        container,
        todoConfig,
        integration as any,
        false,
      );
      const cards = container.querySelector<HTMLElement>(
        ".tasks-kanban-column-cards",
      )!;
      const dt = stubDataTransfer({
        "application/task-path": "notes.md",
        "application/task-line": "3",
      });
      cards.dispatchEvent(dragEvent("drop", dt));
      expect(integration.taskUpdater.updateTaskStatus).not.toHaveBeenCalled();
      col.destroy();
    });

    it("removes drag-over class on drop", () => {
      const integration = mockIntegration([DONE_TASK]);
      const col = new KanbanColumn(
        container,
        todoConfig,
        integration as any,
        false,
      );
      const cards = container.querySelector<HTMLElement>(
        ".tasks-kanban-column-cards",
      )!;
      cards.dispatchEvent(dragEvent("dragover"));
      const dt = stubDataTransfer({
        "application/task-path": "notes.md",
        "application/task-line": "5",
      });
      cards.dispatchEvent(dragEvent("drop", dt));
      expect(
        container.classList.contains("tasks-kanban-column-drag-over"),
      ).toBe(false);
      col.destroy();
    });
  });

  // ── Collapsed: drag events on the column header ───────────────

  describe("drag events (collapsed)", () => {
    it("adds drag-over class on dragover over header", () => {
      const col = new KanbanColumn(
        container,
        todoConfig,
        mockIntegration([]) as any,
        true,
      );
      const header = container.querySelector<HTMLElement>(
        ".tasks-kanban-column-header",
      )!;
      header.dispatchEvent(dragEvent("dragover"));
      expect(
        container.classList.contains("tasks-kanban-column-drag-over"),
      ).toBe(true);
      col.destroy();
    });

    it("removes drag-over class on dragleave from header", () => {
      const col = new KanbanColumn(
        container,
        todoConfig,
        mockIntegration([]) as any,
        true,
      );
      const header = container.querySelector<HTMLElement>(
        ".tasks-kanban-column-header",
      )!;
      header.dispatchEvent(dragEvent("dragover"));
      header.dispatchEvent(dragEvent("dragleave"));
      expect(
        container.classList.contains("tasks-kanban-column-drag-over"),
      ).toBe(false);
      col.destroy();
    });

    it("calls updateTaskStatus on drop over header with valid task data", () => {
      const integration = mockIntegration([DONE_TASK]);
      const col = new KanbanColumn(
        container,
        todoConfig,
        integration as any,
        true,
      );
      const header = container.querySelector<HTMLElement>(
        ".tasks-kanban-column-header",
      )!;
      const dt = stubDataTransfer({
        "application/task-path": "notes.md",
        "application/task-line": "5",
      });
      header.dispatchEvent(dragEvent("drop", dt));
      expect(integration.taskUpdater.updateTaskStatus).toHaveBeenCalledWith(
        DONE_TASK,
        " ",
      );
      col.destroy();
    });

    it("does not call updateTaskStatus when task already belongs to the column", () => {
      const integration = mockIntegration([TODO_TASK]);
      const col = new KanbanColumn(
        container,
        todoConfig,
        integration as any,
        true,
      );
      const header = container.querySelector<HTMLElement>(
        ".tasks-kanban-column-header",
      )!;
      const dt = stubDataTransfer({
        "application/task-path": "notes.md",
        "application/task-line": "3",
      });
      header.dispatchEvent(dragEvent("drop", dt));
      expect(integration.taskUpdater.updateTaskStatus).not.toHaveBeenCalled();
      col.destroy();
    });

    it("removes drag-over class on drop over header", () => {
      const integration = mockIntegration([DONE_TASK]);
      const col = new KanbanColumn(
        container,
        todoConfig,
        integration as any,
        true,
      );
      const header = container.querySelector<HTMLElement>(
        ".tasks-kanban-column-header",
      )!;
      header.dispatchEvent(dragEvent("dragover"));
      const dt = stubDataTransfer({
        "application/task-path": "notes.md",
        "application/task-line": "5",
      });
      header.dispatchEvent(dragEvent("drop", dt));
      expect(
        container.classList.contains("tasks-kanban-column-drag-over"),
      ).toBe(false);
      col.destroy();
    });

    it("does not call updateTaskStatus when dataTransfer is missing", () => {
      const integration = mockIntegration([DONE_TASK]);
      const col = new KanbanColumn(
        container,
        todoConfig,
        integration as any,
        true,
      );
      const header = container.querySelector<HTMLElement>(
        ".tasks-kanban-column-header",
      )!;
      header.dispatchEvent(dragEvent("drop"));
      expect(integration.taskUpdater.updateTaskStatus).not.toHaveBeenCalled();
      col.destroy();
    });
  });

  // ── Collapse toggle ────────────────────────────────────────────

  describe("collapse toggle", () => {
    it("toggles collapsed state on header click", () => {
      const onToggle = vi.fn();
      const col = new KanbanColumn(
        container,
        todoConfig,
        mockIntegration([]) as any,
        false,
        onToggle,
      );
      const header = container.querySelector<HTMLElement>(
        ".tasks-kanban-column-header",
      )!;
      header.click();
      expect(
        container.classList.contains("tasks-kanban-column-collapsed"),
      ).toBe(true);
      expect(onToggle).toHaveBeenCalledWith(true);
      col.destroy();
    });

    it("calls onToggle with false when expanding", () => {
      const onToggle = vi.fn();
      const col = new KanbanColumn(
        container,
        todoConfig,
        mockIntegration([]) as any,
        true,
        onToggle,
      );
      const header = container.querySelector<HTMLElement>(
        ".tasks-kanban-column-header",
      )!;
      header.click();
      expect(
        container.classList.contains("tasks-kanban-column-collapsed"),
      ).toBe(false);
      expect(onToggle).toHaveBeenCalledWith(false);
      col.destroy();
    });

    it("setCollapsed updates state without firing callback", () => {
      const onToggle = vi.fn();
      const col = new KanbanColumn(
        container,
        todoConfig,
        mockIntegration([]) as any,
        false,
        onToggle,
      );
      col.setCollapsed(true);
      expect(
        container.classList.contains("tasks-kanban-column-collapsed"),
      ).toBe(true);
      expect(onToggle).not.toHaveBeenCalled();
      col.destroy();
    });

    it("setCollapsed is a no-op when state is already the same", () => {
      const onToggle = vi.fn();
      const col = new KanbanColumn(
        container,
        todoConfig,
        mockIntegration([]) as any,
        true,
        onToggle,
      );
      col.setCollapsed(true);
      expect(onToggle).not.toHaveBeenCalled();
      col.destroy();
    });
  });

  // ── Cards container visibility (CSS driven) ────────────────────

  describe("collapsed state", () => {
    it("applies the collapsed class to the column container", () => {
      const col = new KanbanColumn(
        container,
        todoConfig,
        mockIntegration([]) as any,
        true,
      );
      expect(
        container.classList.contains("tasks-kanban-column-collapsed"),
      ).toBe(true);
      col.destroy();
    });

    it("does not apply the collapsed class when expanded", () => {
      const col = new KanbanColumn(
        container,
        todoConfig,
        mockIntegration([]) as any,
        false,
      );
      expect(
        container.classList.contains("tasks-kanban-column-collapsed"),
      ).toBe(false);
      col.destroy();
    });

    it("sets aria-expanded to false when collapsed", () => {
      const col = new KanbanColumn(
        container,
        todoConfig,
        mockIntegration([]) as any,
        true,
      );
      expect(container.getAttribute("aria-expanded")).toBe("false");
      col.destroy();
    });

    it("sets aria-expanded to true when expanded", () => {
      const col = new KanbanColumn(
        container,
        todoConfig,
        mockIntegration([]) as any,
        false,
      );
      expect(container.getAttribute("aria-expanded")).toBe("true");
      col.destroy();
    });
  });

  // ── destroy ────────────────────────────────────────────────────

  describe("destroy", () => {
    it("cleans up cards container drag listeners", () => {
      const col = new KanbanColumn(
        container,
        todoConfig,
        mockIntegration([]) as any,
        false,
      );
      col.destroy();
      const cards = container.querySelector<HTMLElement>(
        ".tasks-kanban-column-cards",
      )!;
      // After destroy the column is still in the DOM but handlers are nulled,
      // so dispatching dragover should not add the class.
      cards.dispatchEvent(dragEvent("dragover"));
      expect(
        container.classList.contains("tasks-kanban-column-drag-over"),
      ).toBe(false);
    });

    it("cleans up header drag listeners", () => {
      const col = new KanbanColumn(
        container,
        todoConfig,
        mockIntegration([]) as any,
        true,
      );
      col.destroy();
      const header = container.querySelector<HTMLElement>(
        ".tasks-kanban-column-header",
      )!;
      header.dispatchEvent(dragEvent("dragover"));
      expect(
        container.classList.contains("tasks-kanban-column-drag-over"),
      ).toBe(false);
    });
  });
});
