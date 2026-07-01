import { describe, it, expect } from "vitest";
import { getUniqueTags, normalizeTag } from "../src/utils/searchFilter";
import type { Task } from "../src/services/TasksIntegration";

// Helper to create a mock task
function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "1",
    description: "Test task",
    status: { symbol: " ", name: "Todo", type: "TODO" },
    tags: [],
    priority: null,
    dueDate: null,
    startDate: null,
    scheduledDate: null,
    doneDate: null,
    createdDate: null,
    cancelledDate: null,
    dependsOn: [],
    recurrence: null,
    taskLocation: { path: "/test.md", lineNumber: 1 },
    originalMarkdown: "- [ ] Test task",
    ...overrides,
  };
}

describe("normalizeTag", () => {
  it("strips a leading #", () => {
    expect(normalizeTag("#work")).toBe("work");
  });

  it("leaves a bare tag unchanged", () => {
    expect(normalizeTag("work")).toBe("work");
  });
});

describe("getUniqueTags", () => {
  it("returns an empty array for no tasks", () => {
    expect(getUniqueTags([])).toEqual([]);
  });

  it("dedupes and sorts tags alphabetically", () => {
    const tasks = [
      createTask({ tags: ["work", "urgent"] }),
      createTask({ id: "2", tags: ["work", "home"] }),
    ];
    expect(getUniqueTags(tasks)).toEqual(["home", "urgent", "work"]);
  });

  it("normalizes #-prefixed and bare tags to the same entry", () => {
    const tasks = [
      createTask({ tags: ["#work"] }),
      createTask({ id: "2", tags: ["work"] }),
    ];
    expect(getUniqueTags(tasks)).toEqual(["work"]);
  });

  it("handles tasks with no tags", () => {
    const tasks = [
      createTask({ tags: [] }),
      createTask({ id: "2", tags: ["a"] }),
    ];
    expect(getUniqueTags(tasks)).toEqual(["a"]);
  });

  it("sorts case-insensitively", () => {
    const tasks = [createTask({ tags: ["Zebra", "apple", "Banana"] })];
    expect(getUniqueTags(tasks)).toEqual(["apple", "Banana", "Zebra"]);
  });
});
