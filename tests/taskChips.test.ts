import { describe, it, expect } from "vitest";
import {
  stripTags,
  getPriorityChip,
  formatDate,
  getDateChips,
  getDependencyChips,
} from "../src/utils/taskChips";
import type { Task } from "../src/services/TasksIntegration";

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "",
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

describe("stripTags", () => {
  it("returns description unchanged when there are no tags", () => {
    expect(stripTags("Buy milk #work", [])).toBe("Buy milk #work");
  });

  it("removes a single trailing tag", () => {
    expect(stripTags("Buy milk #work", ["work"])).toBe("Buy milk");
  });

  it("removes a tag in the middle and collapses whitespace", () => {
    expect(stripTags("Buy #work milk", ["work"])).toBe("Buy milk");
  });

  it("removes multiple tags", () => {
    expect(stripTags("Ship #work #urgent it", ["work", "urgent"])).toBe(
      "Ship it",
    );
  });

  it("removes a nested tag as one token", () => {
    expect(stripTags("Deep task #work/project/sub", ["work/project/sub"])).toBe(
      "Deep task",
    );
  });

  it("does not strip a # that sits mid-word", () => {
    // 'C#' is not a tag token (no boundary before #), and 'sharp' isn't a known tag
    expect(stripTags("Learn C# basics", ["sharp"])).toBe("Learn C# basics");
  });

  it("handles tags supplied with a leading #", () => {
    expect(stripTags("Buy milk #work", ["#work"])).toBe("Buy milk");
  });

  it("leaves unknown #tokens intact", () => {
    expect(stripTags("Buy milk #personal", ["work"])).toBe(
      "Buy milk #personal",
    );
  });

  it("returns the original description if stripping empties the title", () => {
    expect(stripTags("#work", ["work"])).toBe("#work");
  });
});

describe("getPriorityChip", () => {
  it("maps each defined level to the right descriptor", () => {
    expect(getPriorityChip(0)).toMatchObject({ label: "Highest", emoji: "🔺" });
    expect(getPriorityChip(1)).toMatchObject({ label: "High", emoji: "⏫" });
    expect(getPriorityChip(2)).toMatchObject({ label: "Medium", emoji: "🔼" });
    expect(getPriorityChip(4)).toMatchObject({ label: "Low", emoji: "🔽" });
    expect(getPriorityChip(5)).toMatchObject({ label: "Lowest", emoji: "⏬" });
  });

  it("returns null for None (3)", () => {
    expect(getPriorityChip(3)).toBeNull();
  });

  it("returns null for null/undefined/empty", () => {
    expect(getPriorityChip(null)).toBeNull();
    expect(getPriorityChip(undefined)).toBeNull();
    expect(getPriorityChip("")).toBeNull();
  });

  it("returns null for out-of-range values", () => {
    expect(getPriorityChip(6)).toBeNull();
    expect(getPriorityChip(-1)).toBeNull();
    expect(getPriorityChip("nope")).toBeNull();
  });

  it("treats string and numeric input identically", () => {
    expect(getPriorityChip("0")).toEqual(getPriorityChip(0));
  });
});

describe("formatDate", () => {
  it("passes a plain YYYY-MM-DD string through", () => {
    expect(formatDate("2026-06-17")).toBe("2026-06-17");
  });

  it("reduces an ISO datetime string to the date part", () => {
    expect(formatDate("2026-06-17T13:45:00.000Z")).toBe("2026-06-17");
  });

  it("formats a Date using local components", () => {
    expect(formatDate(new Date(2026, 5, 17))).toBe("2026-06-17");
  });

  it("supports a Moment-like object", () => {
    const moment = {
      format: (fmt: string) => (fmt === "YYYY-MM-DD" ? "2026-06-17" : ""),
    };
    expect(formatDate(moment)).toBe("2026-06-17");
  });

  it("returns null for junk and nullish input", () => {
    expect(formatDate("not a date")).toBeNull();
    expect(formatDate(null)).toBeNull();
    expect(formatDate(undefined)).toBeNull();
    expect(formatDate({})).toBeNull();
  });
});

describe("getDateChips", () => {
  const now = new Date(2026, 5, 12); // 2026-06-12

  it("emits chips only for present dates, in lifecycle order", () => {
    const task = createTask({
      createdDate: "2026-06-01",
      dueDate: "2026-06-20",
      doneDate: null,
    });
    const chips = getDateChips(task, now);
    expect(chips.map((c) => c.modifier)).toEqual(["date-created", "date-due"]);
  });

  it("flags a past-due undone task as overdue", () => {
    const task = createTask({ dueDate: "2026-06-01" });
    const chips = getDateChips(task, now);
    expect(chips[0].modifier).toBe("date-due-overdue");
    expect(chips[0].title).toBe("Overdue");
  });

  it("does not flag a past-due done task as overdue", () => {
    const task = createTask({
      dueDate: "2026-06-01",
      status: { symbol: "x", name: "Done", type: "DONE" },
    });
    const chips = getDateChips(task, now);
    expect(chips.find((c) => c.label === "2026-06-01")?.modifier).toBe(
      "date-due",
    );
  });

  it("does not flag a future due date", () => {
    const task = createTask({ dueDate: "2026-06-20" });
    const chips = getDateChips(task, now);
    expect(chips[0].modifier).toBe("date-due");
  });
});

describe("getDependencyChips", () => {
  it("marks a task blocked by an open dependency", () => {
    const blocker = createTask({
      id: "design-schema",
      description: "Design schema",
    });
    const task = createTask({ id: "impl-api", dependsOn: ["design-schema"] });
    const { blocked, dependsOn } = getDependencyChips(task, [blocker, task]);
    expect(blocked).not.toBeNull();
    expect(dependsOn?.label).toBe("1");
  });

  it("does not mark blocked when the dependency is done", () => {
    const blocker = createTask({
      id: "provision-db",
      status: { symbol: "x", name: "Done", type: "DONE" },
    });
    const task = createTask({
      id: "run-migrations",
      dependsOn: ["provision-db"],
    });
    const { blocked } = getDependencyChips(task, [blocker, task]);
    expect(blocked).toBeNull();
  });

  it("counts multiple dependencies and blocks on any open one", () => {
    const ci = createTask({ id: "setup-ci" });
    const cd = createTask({ id: "setup-cd" });
    const task = createTask({
      id: "deploy",
      dependsOn: ["setup-ci", "setup-cd"],
    });
    const { blocked, dependsOn } = getDependencyChips(task, [ci, cd, task]);
    expect(blocked).not.toBeNull();
    expect(dependsOn?.label).toBe("2");
  });

  it("treats a missing dependency as non-blocking but lists it", () => {
    const task = createTask({ id: "orphan", dependsOn: ["does-not-exist"] });
    const { blocked, dependsOn } = getDependencyChips(task, [task]);
    expect(blocked).toBeNull();
    expect(dependsOn?.title).toContain("does-not-exist (missing)");
  });

  it("does not let a task block itself (self-reference)", () => {
    const task = createTask({ id: "loop-a", dependsOn: ["loop-a"] });
    const { blocked } = getDependencyChips(task, [task]);
    expect(blocked).toBeNull();
  });

  it("resolves circular dependencies one level deep without looping", () => {
    const a = createTask({ id: "circ-a", dependsOn: ["circ-b"] });
    const b = createTask({ id: "circ-b", dependsOn: ["circ-a"] });
    // Both open → each is blocked by the other, but no infinite recursion.
    expect(getDependencyChips(a, [a, b]).blocked).not.toBeNull();
    expect(getDependencyChips(b, [a, b]).blocked).not.toBeNull();
  });

  it("resolves duplicate ids and is open if any match is open", () => {
    const open = createTask({ id: "dup", description: "Open one" });
    const done = createTask({
      id: "dup",
      description: "Done one",
      status: { symbol: "x", name: "Done", type: "DONE" },
    });
    const task = createTask({ id: "consumer", dependsOn: ["dup"] });
    const { blocked } = getDependencyChips(task, [open, done, task]);
    expect(blocked).not.toBeNull();
  });

  it("shows the task id directly in the id chip", () => {
    const task = createTask({ id: "design-schema" });
    const { id } = getDependencyChips(task, [task]);
    expect(id?.label).toBe("design-schema");
    expect(id?.emoji).toBe("🆔");
  });

  it("lists dependents in the id chip tooltip when others depend on it", () => {
    const task = createTask({ id: "design-schema" });
    const dependent = createTask({
      id: "impl-api",
      description: "Implement API",
      dependsOn: ["design-schema"],
    });
    const { id } = getDependencyChips(task, [task, dependent]);
    expect(id?.title).toContain("Implement API");
  });

  it("omits the id chip tooltip when nothing depends on the task", () => {
    const task = createTask({ id: "standalone" });
    const { id } = getDependencyChips(task, [task]);
    expect(id?.label).toBe("standalone");
    expect(id?.title).toBeUndefined();
  });

  it("emits no id chip when the task has no id", () => {
    const task = createTask({ id: "" });
    expect(getDependencyChips(task, [task]).id).toBeNull();
  });

  it("reads the blockedBy fallback field", () => {
    const blocker = createTask({ id: "dep" });
    const task = createTask({
      id: "consumer",
      dependsOn: undefined as unknown as string[],
      blockedBy: ["dep"],
    });
    expect(getDependencyChips(task, [blocker, task]).blocked).not.toBeNull();
  });
});
