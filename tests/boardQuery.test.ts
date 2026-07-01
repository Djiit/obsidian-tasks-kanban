import { describe, it, expect } from "vitest";
import {
  applyBoardQuery,
  getGroup,
  getSort,
  getTags,
  getTitle,
  isDefaultGroup,
  isDefaultSort,
  mergeQueries,
  parseQuery,
  serializeQuery,
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
        "due before 2026-01-01",
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

  it("serializes a mixed query deterministically", () => {
    const { query } = parseQuery(
      "tag includes #work\ndescription includes write\nsort by priority reverse",
    );
    expect(serializeQuery(query)).toBe(
      "tag includes #work\ndescription includes write\nsort by priority reverse",
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
