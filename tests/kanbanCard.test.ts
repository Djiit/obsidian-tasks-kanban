import { describe, it, expect, vi } from "vitest";
import { KanbanCard } from "../src/components/KanbanCard";
import type { Task } from "../src/services/TasksIntegration";

const TASK: Task = {
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
  taskLocation: { path: "notes.md", lineNumber: 12 },
  originalMarkdown: "- [ ] A todo task",
};

function mockIntegration(file: unknown) {
  const openFile = vi.fn().mockResolvedValue(undefined);
  const getLeaf = vi.fn().mockReturnValue({ openFile });
  const getFileByPath = vi.fn().mockReturnValue(file);
  const integration = {
    getTasks: vi.fn().mockReturnValue([]),
    app: {
      vault: { getFileByPath },
      workspace: { getLeaf },
    },
  };
  return { integration: integration as any, openFile, getFileByPath };
}

describe("KanbanCard", () => {
  it("opens the source file and scrolls to the task's line on click", () => {
    const file = { path: "notes.md" };
    const { integration, openFile, getFileByPath } = mockIntegration(file);
    const container = document.createElement("div");
    const card = new KanbanCard(container, TASK, integration);
    card.render();

    container.click();

    expect(getFileByPath).toHaveBeenCalledWith("notes.md");
    expect(openFile).toHaveBeenCalledWith(file, { eState: { line: 12 } });
    card.destroy();
  });

  it("does nothing when the source file can't be found", () => {
    const { integration, openFile } = mockIntegration(null);
    const container = document.createElement("div");
    const card = new KanbanCard(container, TASK, integration);
    card.render();

    container.click();

    expect(openFile).not.toHaveBeenCalled();
    card.destroy();
  });
});
