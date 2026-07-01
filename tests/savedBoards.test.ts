import { describe, it, expect } from "vitest";
import {
  createSavedBoard,
  findSavedBoard,
  removeSavedBoard,
  upsertSavedBoard,
} from "../src/query/savedBoards";
import type { SavedBoard } from "../src/types/persistence";

function saved(overrides: Partial<SavedBoard> = {}): SavedBoard {
  return {
    id: "id-1",
    name: "Board",
    query: "",
    collapsedColumns: [],
    ...overrides,
  };
}

describe("createSavedBoard", () => {
  it("creates an empty board with the given name and a unique id", () => {
    const a = createSavedBoard("Work");
    const b = createSavedBoard("Work");
    expect(a.name).toBe("Work");
    expect(a.query).toBe("");
    expect(a.collapsedColumns).toEqual([]);
    expect(a.id).not.toBe(b.id);
  });

  it("has no custom columns by default (uses default status columns)", () => {
    expect(createSavedBoard("Work").columns).toBeUndefined();
  });
});

describe("upsertSavedBoard with columns", () => {
  it("preserves a board's custom columns", () => {
    const board = saved({
      id: "a",
      columns: [{ id: "c1", title: "Ongoing", symbols: ["/"] }],
    });
    const next = upsertSavedBoard([], board);
    expect(next[0].columns).toEqual([
      { id: "c1", title: "Ongoing", symbols: ["/"] },
    ]);
  });
});

describe("findSavedBoard", () => {
  it("returns the matching board", () => {
    const list = [saved({ id: "a" }), saved({ id: "b", name: "B" })];
    expect(findSavedBoard(list, "b")?.name).toBe("B");
  });

  it("returns undefined when absent", () => {
    expect(findSavedBoard([saved({ id: "a" })], "z")).toBeUndefined();
  });
});

describe("upsertSavedBoard", () => {
  it("appends when the id is new", () => {
    const list = [saved({ id: "a" })];
    const next = upsertSavedBoard(list, saved({ id: "b" }));
    expect(next.map((b) => b.id)).toEqual(["a", "b"]);
    expect(list).toHaveLength(1); // input not mutated
  });

  it("replaces in place when the id exists", () => {
    const list = [saved({ id: "a", name: "old" }), saved({ id: "b" })];
    const next = upsertSavedBoard(list, saved({ id: "a", name: "new" }));
    expect(next.map((b) => b.name)).toEqual(["new", "Board"]);
    expect(next).toHaveLength(2);
  });
});

describe("removeSavedBoard", () => {
  it("removes the matching id", () => {
    const list = [saved({ id: "a" }), saved({ id: "b" })];
    expect(removeSavedBoard(list, "a").map((b) => b.id)).toEqual(["b"]);
  });

  it("is a no-op when the id is absent", () => {
    const list = [saved({ id: "a" })];
    expect(removeSavedBoard(list, "z")).toEqual(list);
  });
});
