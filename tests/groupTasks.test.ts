import { describe, it, expect } from "vitest";
import { groupTasks, type GroupState } from "../src/utils/groupTasks";
import type { Task } from "../src/services/TasksIntegration";

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
    taskLocation: { path: "work/projects/file.md", lineNumber: 1 },
    originalMarkdown: "- [ ] Test task",
    ...overrides,
  };
}

const state = (overrides: Partial<GroupState> = {}): GroupState => ({
  field: "none",
  direction: "asc",
  ...overrides,
});

const labels = (tasks: Task[], s: GroupState) =>
  groupTasks(tasks, s).map((g) => g.label);

describe("groupTasks none", () => {
  it("returns a single unlabeled lane preserving order", () => {
    const tasks = [createTask({ id: "a" }), createTask({ id: "b" })];
    const groups = groupTasks(tasks, state());
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("");
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["a", "b"]);
  });
});

describe("groupTasks by priority", () => {
  it("orders lanes by semantic priority with None last", () => {
    const tasks = [
      createTask({ id: "none", priority: null }),
      createTask({ id: "lowest", priority: 5 }),
      createTask({ id: "medium", priority: 2 }),
      createTask({ id: "high", priority: 1 }),
      createTask({ id: "low", priority: 4 }),
      createTask({ id: "highest", priority: 0 }),
    ];
    expect(labels(tasks, state({ field: "priority" }))).toEqual([
      "Highest",
      "High",
      "Medium",
      "Low",
      "Lowest",
      "None",
    ]);
  });

  it("reverse flips semantic priority order while keeping None last", () => {
    const tasks = [
      createTask({ id: "none", priority: null }),
      createTask({ id: "highest", priority: 0 }),
      createTask({ id: "medium", priority: 2 }),
      createTask({ id: "lowest", priority: 5 }),
    ];
    expect(
      labels(tasks, state({ field: "priority", direction: "desc" })),
    ).toEqual(["Lowest", "Medium", "Highest", "None"]);
  });
});

describe("groupTasks by tags", () => {
  it("places a multi-tag task under each tag", () => {
    const tasks = [createTask({ id: "a", tags: ["work", "urgent"] })];
    const groups = groupTasks(tasks, state({ field: "tags" }));
    expect(groups.map((g) => g.label)).toEqual(["urgent", "work"]);
    expect(groups.every((g) => g.tasks[0].id === "a")).toBe(true);
  });

  it("collects untagged tasks under a trailing None lane", () => {
    const tasks = [
      createTask({ id: "tagged", tags: ["work"] }),
      createTask({ id: "bare", tags: [] }),
    ];
    const groups = groupTasks(tasks, state({ field: "tags" }));
    expect(groups.map((g) => g.label)).toEqual(["work", "None"]);
    expect(groups[1].tasks.map((t) => t.id)).toEqual(["bare"]);
  });
});

describe("groupTasks missing values", () => {
  it("keeps the None lane last even when reversed", () => {
    const tasks = [
      createTask({ id: "a", tags: ["alpha"] }),
      createTask({ id: "none", tags: [] }),
      createTask({ id: "b", tags: ["beta"] }),
    ];
    const asc = labels(tasks, state({ field: "tags" }));
    expect(asc[asc.length - 1]).toBe("None");
    const desc = labels(tasks, state({ field: "tags", direction: "desc" }));
    expect(desc[desc.length - 1]).toBe("None");
  });
});

describe("groupTasks path derivations", () => {
  it("groups by folder (trailing slash)", () => {
    const tasks = [
      createTask({
        taskLocation: { path: "work/projects/file.md", lineNumber: 1 },
      }),
    ];
    expect(labels(tasks, state({ field: "folder" }))).toEqual([
      "work/projects/",
    ]);
  });

  it("groups by filename without extension", () => {
    const tasks = [
      createTask({
        taskLocation: { path: "work/projects/file.md", lineNumber: 1 },
      }),
    ];
    expect(labels(tasks, state({ field: "filename" }))).toEqual(["file"]);
  });

  it('groups root-level files under "/" folder', () => {
    const tasks = [
      createTask({ taskLocation: { path: "inbox.md", lineNumber: 1 } }),
    ];
    expect(labels(tasks, state({ field: "folder" }))).toEqual(["/"]);
  });
});
