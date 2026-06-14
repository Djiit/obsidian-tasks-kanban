import type { SavedBoard } from "../types/persistence";

/**
 * Pure helpers for managing the list of saved boards. All operations return new
 * values and never mutate their inputs, so they are trivially testable and safe
 * to use against the plugin's in-memory state.
 */

/** Create a new, empty saved board with a stable id. */
export function createSavedBoard(name: string): SavedBoard {
  return {
    id: crypto.randomUUID(),
    name,
    query: "",
    collapsedColumns: [],
  };
}

/** Find a saved board by id, or undefined if absent. */
export function findSavedBoard(
  list: SavedBoard[],
  id: string,
): SavedBoard | undefined {
  return list.find((b) => b.id === id);
}

/**
 * Insert or replace a saved board by id. If one with the same id exists it is
 * replaced in place; otherwise the board is appended.
 */
export function upsertSavedBoard(
  list: SavedBoard[],
  board: SavedBoard,
): SavedBoard[] {
  const index = list.findIndex((b) => b.id === board.id);
  if (index === -1) {
    return [...list, board];
  }
  const next = [...list];
  next[index] = board;
  return next;
}

/** Remove the saved board with the given id (no-op if absent). */
export function removeSavedBoard(list: SavedBoard[], id: string): SavedBoard[] {
  return list.filter((b) => b.id !== id);
}
