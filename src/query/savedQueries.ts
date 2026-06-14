import type { SavedQuery } from "../types/persistence";

/**
 * Pure helpers for managing the list of saved queries. All operations return new
 * values and never mutate their inputs, so they are trivially testable and safe
 * to use against the plugin's in-memory state.
 */

/** Create a new, empty saved query with a stable id. */
export function createSavedQuery(name: string): SavedQuery {
  return {
    id: crypto.randomUUID(),
    name,
    query: "",
    collapsedColumns: [],
  };
}

/** Find a saved query by id, or undefined if absent. */
export function findSavedQuery(
  list: SavedQuery[],
  id: string,
): SavedQuery | undefined {
  return list.find((q) => q.id === id);
}

/**
 * Insert or replace a saved query by id. If one with the same id exists it is
 * replaced in place; otherwise the query is appended.
 */
export function upsertSavedQuery(
  list: SavedQuery[],
  query: SavedQuery,
): SavedQuery[] {
  const index = list.findIndex((q) => q.id === query.id);
  if (index === -1) {
    return [...list, query];
  }
  const next = [...list];
  next[index] = query;
  return next;
}

/** Remove the saved query with the given id (no-op if absent). */
export function removeSavedQuery(list: SavedQuery[], id: string): SavedQuery[] {
  return list.filter((q) => q.id !== id);
}
