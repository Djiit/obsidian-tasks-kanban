import { describe, it, expect } from "vitest";
import {
  parseDateFilter,
  matchesDateFilter,
  serializeDateFilter,
  DATE_KEYWORD_TO_FIELD,
  DATE_FIELD_TO_KEYWORD,
} from "../src/utils/dateFilter";
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
    taskLocation: { path: "/test.md", lineNumber: 1 },
    originalMarkdown: "- [ ] Test task",
    ...overrides,
  };
}

describe("DATE_KEYWORD_TO_FIELD", () => {
  it("maps singular date keywords to fields", () => {
    expect(DATE_KEYWORD_TO_FIELD.due).toBe("dueDate");
    expect(DATE_KEYWORD_TO_FIELD.scheduled).toBe("scheduledDate");
    expect(DATE_KEYWORD_TO_FIELD.start).toBe("startDate");
    expect(DATE_KEYWORD_TO_FIELD.created).toBe("createdDate");
    expect(DATE_KEYWORD_TO_FIELD.done).toBe("doneDate");
    expect(DATE_KEYWORD_TO_FIELD.cancelled).toBe("cancelledDate");
  });

  it("maps plural date keywords to fields", () => {
    expect(DATE_KEYWORD_TO_FIELD.dues).toBe("dueDate");
    expect(DATE_KEYWORD_TO_FIELD.scheduleds).toBe("scheduledDate");
    expect(DATE_KEYWORD_TO_FIELD.starts).toBe("startDate");
    expect(DATE_KEYWORD_TO_FIELD.createds).toBe("createdDate");
    expect(DATE_KEYWORD_TO_FIELD.dones).toBe("doneDate");
    expect(DATE_KEYWORD_TO_FIELD.cancelleds).toBe("cancelledDate");
  });
});

describe("parseDateFilter", () => {
  it("parses date filters with explicit operators", () => {
    const filter = parseDateFilter("starts before tomorrow");
    expect(filter).not.toBeNull();
    expect(filter?.kind).toBe("date");
    expect(filter?.field).toBe("startDate");
    expect(filter?.operator).toBe("before");
    expect(filter?.value).toBe("tomorrow");
    expect(filter?.keyword).toBe("starts");
  });

  it("parses date filters with all date fields", () => {
    const fields = [
      "due",
      "scheduled",
      "start",
      "created",
      "done",
      "cancelled",
    ];
    for (const field of fields) {
      const filter = parseDateFilter(`${field} after 2026-01-01`);
      expect(filter).not.toBeNull();
      expect(filter?.kind).toBe("date");
      expect(filter?.operator).toBe("after");
      expect(filter?.value).toBe("2026-01-01");
    }
  });

  it("parses implicit 'on' operator for relative dates", () => {
    const filter = parseDateFilter("starts today");
    expect(filter).not.toBeNull();
    expect(filter?.operator).toBe("on");
    expect(filter?.value).toBe("today");
  });

  it("parses implicit 'in' operator for relative periods", () => {
    const filter = parseDateFilter("starts this week");
    expect(filter).not.toBeNull();
    expect(filter?.operator).toBe("in");
    expect(filter?.value).toBe("this week");
  });

  it("parses 'has' operator", () => {
    const filter = parseDateFilter("has start date");
    expect(filter).not.toBeNull();
    expect(filter?.field).toBe("startDate");
    expect(filter?.operator).toBe("has");
    expect(filter?.value).toBe("date");
  });

  it("parses 'no' operator", () => {
    const filter = parseDateFilter("no due date");
    expect(filter).not.toBeNull();
    expect(filter?.field).toBe("dueDate");
    expect(filter?.operator).toBe("no");
    expect(filter?.value).toBe("date");
  });

  it("returns null for invalid date fields", () => {
    const filter = parseDateFilter("invalid after 2026-01-01");
    expect(filter).toBeNull();
  });

  it("returns null for invalid operators", () => {
    const filter = parseDateFilter("starts invalid 2026-01-01");
    expect(filter).toBeNull();
  });

  it("handles case-insensitive input", () => {
    const filter1 = parseDateFilter("STARTS BEFORE TOMORROW");
    expect(filter1).not.toBeNull();
    expect(filter1?.field).toBe("startDate");

    const filter2 = parseDateFilter("Due After 2026-01-01");
    expect(filter2).not.toBeNull();
    expect(filter2?.field).toBe("dueDate");
  });

  it("parses all date field singular and plural forms", () => {
    const fields = [
      "due",
      "dues",
      "scheduled",
      "scheduleds",
      "start",
      "starts",
      "created",
      "createds",
      "done",
      "dones",
      "cancelled",
      "cancelleds",
    ];
    for (const field of fields) {
      const filter = parseDateFilter(`${field} before tomorrow`);
      expect(filter).not.toBeNull();
      expect(filter?.kind).toBe("date");
      expect(filter?.operator).toBe("before");
      expect(filter?.value).toBe("tomorrow");
    }
  });

  it("parses all operators with date values", () => {
    const operators = ["before", "after", "on", "in"];
    for (const op of operators) {
      const filter = parseDateFilter(`due ${op} 2026-07-10`);
      expect(filter).not.toBeNull();
      expect(filter?.operator).toBe(op);
      expect(filter?.value).toBe("2026-07-10");
    }
  });

  it("parses implicit 'on' for yesterday", () => {
    const filter = parseDateFilter("starts yesterday");
    expect(filter).not.toBeNull();
    expect(filter?.operator).toBe("on");
    expect(filter?.value).toBe("yesterday");
  });

  it("parses all relative periods with implicit 'in' operator", () => {
    const periods = [
      "this week",
      "next week",
      "last week",
      "this month",
      "next month",
      "last month",
      "this year",
    ];
    for (const period of periods) {
      const filter = parseDateFilter(`starts ${period}`);
      expect(filter).not.toBeNull();
      expect(filter?.operator).toBe("in");
      expect(filter?.value).toBe(period);
    }
  });
});

describe("matchesDateFilter", () => {
  const referenceDate = new Date("2026-07-10T12:00:00");

  it("matches tasks with start date before tomorrow", () => {
    const filter = parseDateFilter("starts before tomorrow");
    expect(filter).not.toBeNull();

    const pastTask = createTask({ startDate: "2026-07-01" });
    const todayTask = createTask({ startDate: "2026-07-10" });
    const futureTask = createTask({ startDate: "2026-07-15" });
    const noDateTask = createTask({ startDate: null });

    expect(matchesDateFilter(pastTask, filter!, referenceDate)).toBe(true);
    expect(matchesDateFilter(todayTask, filter!, referenceDate)).toBe(true);
    expect(matchesDateFilter(futureTask, filter!, referenceDate)).toBe(false);
    expect(matchesDateFilter(noDateTask, filter!, referenceDate)).toBe(false);
  });

  it("matches tasks with due date after a specific date", () => {
    const filter = parseDateFilter("due after 2026-07-10");
    expect(filter).not.toBeNull();

    const beforeTask = createTask({ dueDate: "2026-07-09" });
    const onTask = createTask({ dueDate: "2026-07-10" });
    const afterTask = createTask({ dueDate: "2026-07-11" });

    expect(matchesDateFilter(beforeTask, filter!, referenceDate)).toBe(false);
    expect(matchesDateFilter(onTask, filter!, referenceDate)).toBe(false);
    expect(matchesDateFilter(afterTask, filter!, referenceDate)).toBe(true);
  });

  it("matches tasks with start date on today", () => {
    const filter = parseDateFilter("starts today");
    expect(filter).not.toBeNull();

    const todayTask = createTask({ startDate: "2026-07-10" });
    const otherTask = createTask({ startDate: "2026-07-11" });

    expect(matchesDateFilter(todayTask, filter!, referenceDate)).toBe(true);
    expect(matchesDateFilter(otherTask, filter!, referenceDate)).toBe(false);
  });

  it("matches tasks with has start date", () => {
    const filter = parseDateFilter("has start date");
    expect(filter).not.toBeNull();

    const hasDateTask = createTask({ startDate: "2026-07-10" });
    const nullDateTask = createTask({ startDate: null });
    const emptyDateTask = createTask({ startDate: "" });

    expect(matchesDateFilter(hasDateTask, filter!, referenceDate)).toBe(true);
    expect(matchesDateFilter(nullDateTask, filter!, referenceDate)).toBe(false);
    expect(matchesDateFilter(emptyDateTask, filter!, referenceDate)).toBe(
      false,
    );
  });

  it("matches tasks with no start date", () => {
    const filter = parseDateFilter("no start date");
    expect(filter).not.toBeNull();

    const hasDateTask = createTask({ startDate: "2026-07-10" });
    const nullDateTask = createTask({ startDate: null });
    const emptyDateTask = createTask({ startDate: "" });

    expect(matchesDateFilter(hasDateTask, filter!, referenceDate)).toBe(false);
    expect(matchesDateFilter(nullDateTask, filter!, referenceDate)).toBe(true);
    expect(matchesDateFilter(emptyDateTask, filter!, referenceDate)).toBe(true);
  });

  it("matches tasks in this week", () => {
    const filter = parseDateFilter("starts in this week");
    expect(filter).not.toBeNull();

    // 2026-07-10 is a Thursday (assuming)
    // This week would be Sunday 2026-07-05 to Saturday 2026-07-11
    const inWeekTask = createTask({ startDate: "2026-07-07" }); // Monday
    const outOfWeekTask = createTask({ startDate: "2026-07-14" }); // Next Monday

    expect(matchesDateFilter(inWeekTask, filter!, referenceDate)).toBe(true);
    expect(matchesDateFilter(outOfWeekTask, filter!, referenceDate)).toBe(
      false,
    );
  });

  it("matches tasks due before tomorrow", () => {
    const filter = parseDateFilter("due before tomorrow");
    expect(filter).not.toBeNull();

    const todayTask = createTask({ dueDate: "2026-07-10" });
    const pastTask = createTask({ dueDate: "2026-07-09" });
    const futureTask = createTask({ dueDate: "2026-07-11" });
    const noDateTask = createTask({ dueDate: null });

    expect(matchesDateFilter(todayTask, filter!, referenceDate)).toBe(true);
    expect(matchesDateFilter(pastTask, filter!, referenceDate)).toBe(true);
    expect(matchesDateFilter(futureTask, filter!, referenceDate)).toBe(false);
    expect(matchesDateFilter(noDateTask, filter!, referenceDate)).toBe(false);
  });

  it("matches tasks scheduled after a specific date", () => {
    const filter = parseDateFilter("scheduled after 2026-01-01");
    expect(filter).not.toBeNull();

    const beforeTask = createTask({ scheduledDate: "2025-12-31" });
    const onTask = createTask({ scheduledDate: "2026-01-01" });
    const afterTask = createTask({ scheduledDate: "2026-01-02" });

    expect(matchesDateFilter(beforeTask, filter!, referenceDate)).toBe(false);
    expect(matchesDateFilter(onTask, filter!, referenceDate)).toBe(false);
    expect(matchesDateFilter(afterTask, filter!, referenceDate)).toBe(true);
  });

  it("matches tasks created in this month", () => {
    const filter = parseDateFilter("created in this month");
    expect(filter).not.toBeNull();

    const inMonthTask = createTask({ createdDate: "2026-07-01" });
    const outOfMonthTask = createTask({ createdDate: "2026-06-30" });

    expect(matchesDateFilter(inMonthTask, filter!, referenceDate)).toBe(true);
    expect(matchesDateFilter(outOfMonthTask, filter!, referenceDate)).toBe(
      false,
    );
  });

  it("matches tasks with no due date", () => {
    const filter = parseDateFilter("no due date");
    expect(filter).not.toBeNull();

    const hasDueTask = createTask({ dueDate: "2026-07-10" });
    const nullDueTask = createTask({ dueDate: null });
    const emptyDueTask = createTask({ dueDate: "" });

    expect(matchesDateFilter(hasDueTask, filter!, referenceDate)).toBe(false);
    expect(matchesDateFilter(nullDueTask, filter!, referenceDate)).toBe(true);
    expect(matchesDateFilter(emptyDueTask, filter!, referenceDate)).toBe(true);
  });

  it("matches tasks with start date on yesterday", () => {
    const filter = parseDateFilter("starts yesterday");
    expect(filter).not.toBeNull();

    // yesterday relative to 2026-07-10 is 2026-07-09
    const yesterdayTask = createTask({ startDate: "2026-07-09" });
    const todayTask = createTask({ startDate: "2026-07-10" });

    expect(matchesDateFilter(yesterdayTask, filter!, referenceDate)).toBe(true);
    expect(matchesDateFilter(todayTask, filter!, referenceDate)).toBe(false);
  });

  it("handles plural date field forms", () => {
    const filter = parseDateFilter("starts before tomorrow");
    expect(filter).not.toBeNull();

    const pastTask = createTask({ startDate: "2026-07-01" });
    expect(matchesDateFilter(pastTask, filter!, referenceDate)).toBe(true);
  });
});

describe("serializeDateFilter", () => {
  it("serializes date filters with original keyword", () => {
    const filter = parseDateFilter("starts before tomorrow");
    expect(filter).not.toBeNull();
    expect(serializeDateFilter(filter!)).toBe("starts before tomorrow");
  });

  it("serializes date filters with singular keyword when no original", () => {
    const filter = {
      kind: "date" as const,
      field: "startDate",
      operator: "before" as const,
      value: "tomorrow",
    };
    expect(serializeDateFilter(filter)).toBe("start before tomorrow");
  });

  it("serializes 'has' operator filters", () => {
    const filter = parseDateFilter("has start date");
    expect(filter).not.toBeNull();
    expect(serializeDateFilter(filter!)).toBe("start has date");
  });

  it("serializes 'no' operator filters", () => {
    const filter = parseDateFilter("no due date");
    expect(filter).not.toBeNull();
    expect(serializeDateFilter(filter!)).toBe("due no date");
  });
});
