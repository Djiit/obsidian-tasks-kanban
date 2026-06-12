import type { Task } from "../services/TasksIntegration";

/**
 * The state of the top search bar: a free-text title query and a set of
 * selected tag names (bare, without a leading '#').
 */
export interface SearchState {
  titleQuery: string;
  selectedTags: string[];
}

/**
 * Strip a leading '#' from a tag. task.tags may or may not carry one depending
 * on the source (see stripTags in taskChips.ts), so we normalise to bare bodies
 * before comparison and display.
 */
export function normalizeTag(tag: string): string {
  return tag.startsWith("#") ? tag.slice(1) : tag;
}

/**
 * Collect the unique, normalised tags across all tasks, sorted alphabetically.
 * Used to populate the tag filter dropdown.
 */
export function getUniqueTags(tasks: Task[]): string[] {
  const set = new Set<string>();
  for (const task of tasks) {
    for (const tag of task.tags ?? []) {
      const normalized = normalizeTag(tag);
      if (normalized) {
        set.add(normalized);
      }
    }
  }
  return Array.from(set).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

/**
 * Filter tasks by the search bar state.
 *
 * - Title: if a non-empty query is set, keep tasks whose description contains it
 *   (case-insensitive, trimmed substring match).
 * - Tags: if any tags are selected, keep tasks carrying at least one of them (OR).
 * - The two constraints are combined with AND.
 *
 * An empty state (no query, no tags) returns a shallow copy of all tasks.
 */
export function filterTasksBySearch(tasks: Task[], state: SearchState): Task[] {
  const query = state.titleQuery.trim().toLowerCase();
  const selected = new Set(state.selectedTags.map(normalizeTag));

  if (query === "" && selected.size === 0) {
    return [...tasks];
  }

  return tasks.filter((task) => {
    if (query !== "" && !task.description.toLowerCase().includes(query)) {
      return false;
    }

    if (selected.size > 0) {
      const taskTags = task.tags ?? [];
      const hasMatch = taskTags.some((tag) => selected.has(normalizeTag(tag)));
      if (!hasMatch) {
        return false;
      }
    }

    return true;
  });
}
