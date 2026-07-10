import { describe, it, expect } from "vitest";
import {
  applyBoardQuery,
  getExcludedTags,
  getGroup,
  getSort,
  getTags,
  getTitle,
  isDefaultGroup,
  isDefaultSort,
  mergeQueries,
  parseQuery,
  serializeQuery,
  withExcludedTags,
  withGroup,
  withSort,
  withTags,
  withTitle,
} from "../src/query/boardQuery";
import { DEFAULT_SORT_STATE } from "../src/utils/sortTasks";
import { DEFAULT_GROUP_STATE } from "../src/utils/groupTasks";
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

const ids = (tasks: Task[]) => tasks.map((t) => t.id);

describe("parseQuery", () => {
  it("returns empty query for blank input", () => {
    const { query, errors } = parseQuery("");
    expect(query.filters).toEqual([]);
    expect(query.sort).toEqual(DEFAULT_SORT_STATE);
    expect(errors).toEqual([]);
  });

  it("ignores blank lines", () => {
    const { query } = parseQuery(
      "tag includes #work\n\n  \ntag includes #home",
    );
    expect(getTags(query)).toEqual(["work", "home"]);
  });

  it('parses "tag includes" and strips the leading #', () => {
    const { query, errors } = parseQuery(
      "tag includes #work\ntag includes home",
    );
    expect(getTags(query)).toEqual(["work", "home"]);
    expect(errors).toEqual([]);
  });

  it('parses "tag not includes" and strips the leading #', () => {
    const { query, errors } = parseQuery(
      "tag not includes #book\ntag not includes movie",
    );
    expect(getExcludedTags(query)).toEqual(["book", "movie"]);
    expect(errors).toEqual([]);
  });

  it('parses "description includes"', () => {
    const { query } = parseQuery("description includes write tests");
    expect(query.filters).toEqual([
      { kind: "description", value: "write tests" },
    ]);
  });

  it("parses sort with and without reverse", () => {
    expect(parseQuery("sort by priority").query.sort).toEqual({
      field: "priority",
      direction: "asc",
    });
    expect(parseQuery("sort by due reverse").query.sort).toEqual({
      field: "dueDate",
      direction: "desc",
    });
  });

  it("maps each sort keyword to its field", () => {
    expect(parseQuery("sort by scheduled").query.sort.field).toBe(
      "scheduledDate",
    );
    expect(parseQuery("sort by start").query.sort.field).toBe("startDate");
    expect(parseQuery("sort by created").query.sort.field).toBe("createdDate");
  });

  describe("date filters", () => {
    it('parses "starts before tomorrow"', () => {
      const { query, errors } = parseQuery("starts before tomorrow");
      expect(errors).toEqual([]);
      expect(query.filters).toHaveLength(1);
      expect(query.filters[0]).toMatchObject({
        kind: "date",
        field: "startDate",
        operator: "before",
        value: "tomorrow",
      });
    });

    it('parses "due after 2026-07-10"', () => {
      const { query, errors } = parseQuery("due after 2026-07-10");
      expect(errors).toEqual([]);
      expect(query.filters).toHaveLength(1);
      expect(query.filters[0]).toMatchObject({
        kind: "date",
        field: "dueDate",
        operator: "after",
        value: "2026-07-10",
      });
    });

    it('parses "starts today"', () => {
      const { query, errors } = parseQuery("starts today");
      expect(errors).toEqual([]);
      expect(query.filters).toHaveLength(1);
      expect(query.filters[0]).toMatchObject({
        kind: "date",
        field: "startDate",
        operator: "on",
        value: "today",
      });
    });

    it('parses "has start date"', () => {
      const { query, errors } = parseQuery("has start date");
      expect(errors).toEqual([]);
      expect(query.filters).toHaveLength(1);
      expect(query.filters[0]).toMatchObject({
        kind: "date",
        field: "startDate",
        operator: "has",
        value: "date",
      });
    });

    it('parses "no start date"', () => {
      const { query, errors } = parseQuery("no start date");
      expect(errors).toEqual([]);
      expect(query.filters).toHaveLength(1);
      expect(query.filters[0]).toMatchObject({
        kind: "date",
        field: "startDate",
        operator: "no",
        value: "date",
      });
    });

    it('parses "starts in this week"', () => {
      const { query, errors } = parseQuery("starts in this week");
      expect(errors).toEqual([]);
      expect(query.filters).toHaveLength(1);
      expect(query.filters[0]).toMatchObject({
        kind: "date",
        field: "startDate",
        operator: "in",
        value: "this week",
      });
    });

    it("parses date filters for all date fields", () => {
      const fields = [
        "due",
        "scheduled",
        "start",
        "created",
        "done",
        "cancelled",
      ];
      for (const field of fields) {
        const { query, errors } = parseQuery(`${field} after 2026-01-01`);
        expect(errors).toEqual([]);
        expect(query.filters).toHaveLength(1);
        expect(query.filters[0].kind).toBe("date");
        expect(query.filters[0].operator).toBe("after");
        expect(query.filters[0].value).toBe("2026-01-01");
      }
    });

    it("parses all date operators", () => {
      const operators = ["before", "after", "on", "in", "has", "no"];
      for (const op of operators) {
        const { query, errors } = parseQuery(`starts ${op} test`);
        expect(errors).toEqual([]);
        expect(query.filters).toHaveLength(1);
        expect(query.filters[0].kind).toBe("date");
        expect(query.filters[0].operator).toBe(op);
      }
    });

    it("flags invalid date field as error", () => {
      const { query, errors } = parseQuery("invalid after 2026-01-01");
      expect(query.filters).toEqual([]);
      expect(errors).toHaveLength(1);
    });

    it("flags invalid date operator as error", () => {
      const { query, errors } = parseQuery("starts invalid 2026-01-01");
      expect(query.filters).toEqual([]);
      expect(errors).toHaveLength(1);
    });
  });

  describe("tolerant errors on unsupported lines", () => {
    it("flags a bare # tag (no shorthand) and skips it", () => {
      const { query, errors } = parseQuery("#work");
      expect(query.filters).toEqual([]);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("Line 1");
      expect(errors[0]).toContain("unsupported");
    });

    it("flags valid-but-unsupported Tasks instructions", () => {
      for (const line of [
        "path includes Projects",
        "priority is high",
        "done",
        "status.type is TODO",
      ]) {
        const { query, errors } = parseQuery(line);
        expect(query.filters).toEqual([]);
        expect(errors).toHaveLength(1);
      }
    });

    it("treats bare text as unsupported (not a description filter)", () => {
      const { errors } = parseQuery("groceries");
      expect(errors).toHaveLength(1);
    });

    it("flags an unknown sort field", () => {
      const { errors } = parseQuery("sort by frobnicate");
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("unknown sort field");
    });

    it("keeps valid lines while collecting errors for bad ones", () => {
      const { query, errors } = parseQuery(
        "tag includes #work\npath includes X\nsort by due",
      );
      expect(getTags(query)).toEqual(["work"]);
      expect(query.sort.field).toBe("dueDate");
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("Line 2");
    });
  });
});

describe("serializeQuery / round-trip", () => {
  it('serializes tags in reference-exact "tag includes #" form', () => {
    const { query } = parseQuery("tag includes #work");
    expect(serializeQuery(query)).toBe("tag includes #work");
  });

  it('serializes "tag not includes" in reference-exact form', () => {
    const { query } = parseQuery("tag not includes #book");
    expect(serializeQuery(query)).toBe("tag not includes #book");
  });

  it("serializes a mixed query deterministically", () => {
    const { query } = parseQuery(
      "tag includes #work\ndescription includes write\nsort by priority reverse",
    );
    expect(serializeQuery(query)).toBe(
      "tag includes #work\ndescription includes write\nsort by priority reverse",
    );
  });

  it("serializes mixed include/exclude tags", () => {
    const { query } = parseQuery(
      "tag includes #work\ntag not includes #book\nsort by due",
    );
    expect(serializeQuery(query)).toBe(
      "tag includes #work\ntag not includes #book\nsort by due",
    );
  });

  it("serializes date filters", () => {
    const { query } = parseQuery("starts before tomorrow");
    expect(serializeQuery(query)).toBe("starts before tomorrow");
  });

  it("serializes mixed filters including date filters", () => {
    const { query } = parseQuery(
      "tag includes #work\nstarts before tomorrow\nsort by due",
    );
    expect(serializeQuery(query)).toBe(
      "tag includes #work\nstarts before tomorrow\nsort by due",
    );
  });

  it("omits the sort line when there is no sorting", () => {
    const { query } = parseQuery("tag includes #work");
    expect(serializeQuery(query)).toBe("tag includes #work");
  });

  it("round-trips to an equivalent query", () => {
    const source =
      "tag includes #a\ntag includes #b\ndescription includes thing\nsort by scheduled reverse";
    const first = parseQuery(source).query;
    const second = parseQuery(serializeQuery(first)).query;
    expect(second).toEqual(first);
  });

  it("round-trips a query with mixed include/exclude tags", () => {
    const source =
      "tag includes #work\ntag not includes #book\ntag not includes #movie\ndescription includes read\nsort by due reverse";
    const first = parseQuery(source).query;
    const second = parseQuery(serializeQuery(first)).query;
    expect(second).toEqual(first);
  });

  it("round-trips a query with date filters", () => {
    const source = "starts before tomorrow\ndue after 2026-07-10";
    const first = parseQuery(source).query;
    const second = parseQuery(serializeQuery(first)).query;
    expect(second).toEqual(first);
  });
});

describe("slice helpers", () => {
  const base = parseQuery("tag includes #work\nsort by priority").query;

  it("getTitle/getTags/getSort read slices", () => {
    const q = parseQuery(
      "tag includes #work\ndescription includes hi\nsort by due reverse",
    ).query;
    expect(getTitle(q)).toBe("hi");
    expect(getTags(q)).toEqual(["work"]);
    expect(getSort(q)).toEqual({ field: "dueDate", direction: "desc" });
  });

  it("withTitle preserves tags and sort", () => {
    const updated = withTitle(base, "hello");
    expect(getTitle(updated)).toBe("hello");
    expect(getTags(updated)).toEqual(["work"]);
    expect(updated.sort.field).toBe("priority");
  });

  it("withTitle removes the description filter when cleared", () => {
    const withDesc = withTitle(base, "hello");
    const cleared = withTitle(withDesc, "   ");
    expect(getTitle(cleared)).toBe("");
    expect(cleared.filters.some((f) => f.kind === "description")).toBe(false);
  });

  it("withTags replaces tags but keeps the description", () => {
    const withDesc = withTitle(base, "hello");
    const updated = withTags(withDesc, ["home", "urgent"]);
    expect(getTags(updated)).toEqual(["home", "urgent"]);
    expect(getTitle(updated)).toBe("hello");
  });

  it("withTags normalizes a leading #", () => {
    const updated = withTags(base, ["#home"]);
    expect(getTags(updated)).toEqual(["home"]);
  });

  it("withTags does not remove excluded tags", () => {
    const q = parseQuery("tag includes #work\ntag not includes #book").query;
    const updated = withTags(q, ["home"]);
    expect(getTags(updated)).toEqual(["home"]);
    expect(getExcludedTags(updated)).toEqual(["book"]);
  });

  it("getExcludedTags reads excluded tags", () => {
    const q = parseQuery("tag includes #work\ntag not includes #book").query;
    expect(getExcludedTags(q)).toEqual(["book"]);
  });

  it("getExcludedTags returns empty for no excludes", () => {
    const q = parseQuery("tag includes #work").query;
    expect(getExcludedTags(q)).toEqual([]);
  });

  it("withExcludedTags replaces excluded tags, preserving includes", () => {
    const q = parseQuery("tag includes #work\ntag not includes #book").query;
    const updated = withExcludedTags(q, ["movie"]);
    expect(getTags(updated)).toEqual(["work"]);
    expect(getExcludedTags(updated)).toEqual(["movie"]);
  });

  it("withExcludedTags normalizes a leading #", () => {
    const q = parseQuery("tag includes #work").query;
    const updated = withExcludedTags(q, ["#book"]);
    expect(getExcludedTags(updated)).toEqual(["book"]);
  });

  it("withExcludedTags clears excluded tags when given empty array", () => {
    const q = parseQuery("tag includes #work\ntag not includes #book").query;
    const updated = withExcludedTags(q, []);
    expect(getExcludedTags(updated)).toEqual([]);
    expect(getTags(updated)).toEqual(["work"]);
  });

  it("withSort preserves filters", () => {
    const updated = withSort(base, { field: "dueDate", direction: "desc" });
    expect(updated.sort).toEqual({ field: "dueDate", direction: "desc" });
    expect(updated.filters).toEqual(base.filters);
  });
});

describe("applyBoardQuery", () => {
  it("returns a copy when query is empty", () => {
    const tasks = [createTask()];
    const result = applyBoardQuery(tasks, {
      filters: [],
      sort: { ...DEFAULT_SORT_STATE },
    });
    expect(result).not.toBe(tasks);
    expect(result).toHaveLength(1);
  });

  it("ORs tags together", () => {
    const tasks = [
      createTask({ id: "w", tags: ["work"] }),
      createTask({ id: "h", tags: ["home"] }),
      createTask({ id: "o", tags: ["other"] }),
    ];
    const { query } = parseQuery("tag includes #work\ntag includes #home");
    expect(ids(applyBoardQuery(tasks, query))).toEqual(["w", "h"]);
  });

  it("matches #-prefixed query tags against bare task tags", () => {
    const tasks = [createTask({ id: "w", tags: ["work"] })];
    const { query } = parseQuery("tag includes #work");
    expect(ids(applyBoardQuery(tasks, query))).toEqual(["w"]);
  });

  it("ANDs description on top of tags", () => {
    const tasks = [
      createTask({ id: "match", tags: ["work"], description: "Write docs" }),
      createTask({ id: "wrongDesc", tags: ["work"], description: "Fix bugs" }),
      createTask({ id: "wrongTag", tags: ["home"], description: "Write docs" }),
    ];
    const { query } = parseQuery(
      "tag includes #work\ndescription includes write",
    );
    expect(ids(applyBoardQuery(tasks, query))).toEqual(["match"]);
  });

  it("matches description case-insensitively", () => {
    const tasks = [
      createTask({ id: "a", description: "Write documentation" }),
      createTask({ id: "b", description: "Fix bugs" }),
    ];
    const { query } = parseQuery("description includes WRITE");
    expect(ids(applyBoardQuery(tasks, query))).toEqual(["a"]);
  });

  it("sorts filtered results, sinking missing values", () => {
    const tasks = [
      createTask({ id: "late", tags: ["t"], dueDate: "2026-03-01" }),
      createTask({ id: "none", tags: ["t"], dueDate: null }),
      createTask({ id: "early", tags: ["t"], dueDate: "2026-01-01" }),
      createTask({ id: "excluded", tags: ["x"], dueDate: "2025-01-01" }),
    ];
    const { query } = parseQuery("tag includes #t\nsort by due");
    expect(ids(applyBoardQuery(tasks, query))).toEqual([
      "early",
      "late",
      "none",
    ]);
  });

  it('excludes tasks matching a "tag not includes" filter', () => {
    const tasks = [
      createTask({ id: "work", tags: ["work"] }),
      createTask({ id: "book", tags: ["book"] }),
      createTask({ id: "both", tags: ["work", "book"] }),
      createTask({ id: "other", tags: ["other"] }),
    ];
    const { query } = parseQuery("tag not includes #book");
    expect(ids(applyBoardQuery(tasks, query))).toEqual(["work", "other"]);
  });

  it("excludes tasks matching any excluded tag (AND semantic)", () => {
    const tasks = [
      createTask({ id: "a", tags: ["book"] }),
      createTask({ id: "b", tags: ["movie"] }),
      createTask({ id: "c", tags: ["book", "movie"] }),
      createTask({ id: "d", tags: ["other"] }),
    ];
    const { query } = parseQuery(
      "tag not includes #book\ntag not includes #movie",
    );
    expect(ids(applyBoardQuery(tasks, query))).toEqual(["d"]);
  });

  it("combines include and exclude tags correctly", () => {
    const tasks = [
      createTask({ id: "meeting", tags: ["work", "meeting"] }),
      createTask({ id: "code", tags: ["work"] }),
      createTask({ id: "book", tags: ["book"] }),
      createTask({ id: "other", tags: ["other"] }),
    ];
    const { query } = parseQuery(
      "tag includes #work\ntag not includes #meeting",
    );
    expect(ids(applyBoardQuery(tasks, query))).toEqual(["code"]);
  });

  it("handles only excluded tags with no includes", () => {
    const tasks = [
      createTask({ id: "a", tags: ["book"] }),
      createTask({ id: "b", tags: ["other"] }),
    ];
    const { query } = parseQuery("tag not includes #book");
    expect(ids(applyBoardQuery(tasks, query))).toEqual(["b"]);
  });

  it("exclude filter is respected alongside description filter", () => {
    const tasks = [
      createTask({ id: "a", tags: ["book"], description: "Read a book" }),
      createTask({ id: "b", tags: ["work"], description: "Read a book" }),
    ];
    const { query } = parseQuery(
      "tag not includes #book\ndescription includes Read",
    );
    expect(ids(applyBoardQuery(tasks, query))).toEqual(["b"]);
  });

  describe("date filters", () => {
    it("filters tasks by start date before tomorrow", () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const tasks = [
        createTask({ id: "past", startDate: "2026-01-01" }),
        createTask({ id: "today", startDate: toLocalISODate(today) }),
        createTask({ id: "future", startDate: "2026-12-31" }),
        createTask({ id: "none", startDate: null }),
      ];

      const { query } = parseQuery("starts before tomorrow");
      const result = applyBoardQuery(tasks, query);

      // Should include past and today, exclude future and none
      expect(result).toContainEqual(tasks[0]);
      expect(result).toContainEqual(tasks[1]);
      expect(result).not.toContainEqual(tasks[2]);
      expect(result).not.toContainEqual(tasks[3]);
    });

    it("filters tasks by due date after a specific date", () => {
      const tasks = [
        createTask({ id: "past", dueDate: "2026-01-01" }),
        createTask({ id: "future", dueDate: "2026-07-15" }),
        createTask({ id: "none", dueDate: null }),
      ];

      const { query } = parseQuery("due after 2026-07-10");
      const result = applyBoardQuery(tasks, query);

      expect(result).not.toContainEqual(tasks[0]);
      expect(result).toContainEqual(tasks[1]);
      expect(result).not.toContainEqual(tasks[2]);
    });

    it("filters tasks with has start date", () => {
      const tasks = [
        createTask({ id: "hasStart", startDate: "2026-01-01" }),
        createTask({ id: "noStart", startDate: null }),
        createTask({ id: "emptyStart", startDate: "" }),
      ];

      const { query } = parseQuery("has start date");
      const result = applyBoardQuery(tasks, query);

      expect(result).toContainEqual(tasks[0]);
      expect(result).not.toContainEqual(tasks[1]);
      expect(result).not.toContainEqual(tasks[2]);
    });

    it("filters tasks with no start date", () => {
      const tasks = [
        createTask({ id: "hasStart", startDate: "2026-01-01" }),
        createTask({ id: "noStart", startDate: null }),
        createTask({ id: "emptyStart", startDate: "" }),
      ];

      const { query } = parseQuery("no start date");
      const result = applyBoardQuery(tasks, query);

      expect(result).not.toContainEqual(tasks[0]);
      expect(result).toContainEqual(tasks[1]);
      expect(result).toContainEqual(tasks[2]);
    });

    it("combines date filters with tag filters", () => {
      const tasks = [
        createTask({ id: "match", tags: ["work"], startDate: "2026-01-01" }),
        createTask({ id: "wrongTag", tags: ["home"], startDate: "2026-01-01" }),
        createTask({
          id: "wrongDate",
          tags: ["work"],
          startDate: "2026-12-31",
        }),
        createTask({ id: "noMatch", tags: ["home"], startDate: "2026-12-31" }),
      ];

      const { query } = parseQuery(
        "tag includes #work\nstarts before 2026-07-01",
      );
      const result = applyBoardQuery(tasks, query);

      expect(result).toContainEqual(tasks[0]);
      expect(result).not.toContainEqual(tasks[1]);
      expect(result).not.toContainEqual(tasks[2]);
      expect(result).not.toContainEqual(tasks[3]);
    });

    it("combines multiple date filters", () => {
      const tasks = [
        createTask({
          id: "match",
          dueDate: "2026-07-15",
          startDate: "2026-07-10",
        }),
        createTask({
          id: "wrongDue",
          dueDate: "2026-01-01",
          startDate: "2026-07-10",
        }),
        createTask({
          id: "wrongStart",
          dueDate: "2026-07-15",
          startDate: "2026-01-01",
        }),
      ];

      const { query } = parseQuery(
        "due after 2026-07-10\nstarts after 2026-07-05",
      );
      const result = applyBoardQuery(tasks, query);

      expect(result).toContainEqual(tasks[0]);
      expect(result).not.toContainEqual(tasks[1]);
      expect(result).not.toContainEqual(tasks[2]);
    });
  });
});

describe("isDefaultSort", () => {
  it("is true for the default sort state", () => {
    expect(isDefaultSort({ ...DEFAULT_SORT_STATE })).toBe(true);
  });

  it("is false when the field differs", () => {
    expect(isDefaultSort({ field: "dueDate", direction: "asc" })).toBe(false);
  });

  it("is false when the direction differs", () => {
    expect(
      isDefaultSort({ field: DEFAULT_SORT_STATE.field, direction: "desc" }),
    ).toBe(false);
  });
});

describe("mergeQueries", () => {
  it("concatenates filters with base first", () => {
    const base = parseQuery("tag includes #base").query;
    const overlay = parseQuery(
      "tag includes #view\ndescription includes x",
    ).query;
    expect(mergeQueries(base, overlay).filters).toEqual([
      { kind: "tag", value: "base" },
      { kind: "tag", value: "view" },
      { kind: "description", value: "x" },
    ]);
  });

  it("keeps the base sort when the overlay sort is default", () => {
    const base = parseQuery("sort by due reverse").query;
    const overlay = parseQuery("tag includes #view").query;
    expect(mergeQueries(base, overlay).sort).toEqual(base.sort);
  });

  it("lets a non-default overlay sort override the base sort", () => {
    const base = parseQuery("sort by due").query;
    const overlay = parseQuery("sort by priority reverse").query;
    expect(mergeQueries(base, overlay).sort).toEqual(overlay.sort);
  });

  it("merges so a base+overlay read filters like the combined lines", () => {
    const tasks = [
      createTask({ id: "keep", tags: ["base"], description: "do the thing" }),
      createTask({
        id: "wrongTag",
        tags: ["other"],
        description: "do the thing",
      }),
      createTask({ id: "wrongDesc", tags: ["base"], description: "nope" }),
    ];
    const base = parseQuery("tag includes #base").query;
    const overlay = parseQuery("description includes thing").query;
    expect(ids(applyBoardQuery(tasks, mergeQueries(base, overlay)))).toEqual([
      "keep",
    ]);
  });

  it("keeps the base group when the overlay group is default", () => {
    const base = parseQuery("group by priority").query;
    const overlay = parseQuery("tag includes #view").query;
    expect(mergeQueries(base, overlay).group).toEqual(base.group);
  });

  it("lets a non-default overlay group override the base group", () => {
    const base = parseQuery("group by priority").query;
    const overlay = parseQuery("group by status reverse").query;
    expect(mergeQueries(base, overlay).group).toEqual(overlay.group);
  });
});

describe("group by parsing", () => {
  it("parses a group field and reverse", () => {
    expect(parseQuery("group by priority").query.group).toEqual({
      field: "priority",
      direction: "asc",
    });
    expect(parseQuery("group by status reverse").query.group).toEqual({
      field: "status",
      direction: "desc",
    });
  });

  it("maps Tasks keywords to internal fields", () => {
    expect(parseQuery("group by folder").query.group.field).toBe("folder");
    expect(parseQuery("group by tags").query.group.field).toBe("tags");
    expect(parseQuery("group by filename").query.group.field).toBe("filename");
  });

  it("rejects date-based group fields (they scatter the board)", () => {
    const { errors } = parseQuery("group by due");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("unknown group field");
  });

  it("reports an unknown group field as an error", () => {
    const { errors } = parseQuery("group by nonsense");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("unknown group field");
  });

  it("last group by wins", () => {
    expect(
      parseQuery("group by priority\ngroup by status").query.group.field,
    ).toBe("status");
  });

  it("round-trips through serializeQuery", () => {
    const input = "tag includes #work\nsort by due reverse\ngroup by priority";
    const { query } = parseQuery(input);
    expect(parseQuery(serializeQuery(query)).query).toEqual(query);
  });
});

describe("isDefaultGroup", () => {
  it("is true for the default group state", () => {
    expect(isDefaultGroup({ ...DEFAULT_GROUP_STATE })).toBe(true);
  });

  it("is false when the field differs", () => {
    expect(isDefaultGroup({ field: "priority", direction: "asc" })).toBe(false);
  });
});

describe("getGroup / withGroup", () => {
  it("replaces the group slice, preserving filters and sort", () => {
    const query = parseQuery("tag includes #work\nsort by due").query;
    const next = withGroup(query, { field: "priority", direction: "desc" });
    expect(getGroup(next)).toEqual({ field: "priority", direction: "desc" });
    expect(next.filters).toEqual(query.filters);
    expect(next.sort).toEqual(query.sort);
  });
});

// Helper function for date tests
function toLocalISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
