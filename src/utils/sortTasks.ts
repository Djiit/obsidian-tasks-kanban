import type { Task } from "../services/TasksIntegration";

/**
 * A field the board can be sorted by. `'none'` preserves the order tasks arrive
 * in from the Tasks cache (the default).
 */
export type SortField =
  | "none"
  | "priority"
  | "dueDate"
  | "scheduledDate"
  | "startDate"
  | "createdDate";

/** The subset of {@link SortField} that maps to a date string on a Task. */
type DateSortField = "dueDate" | "scheduledDate" | "startDate" | "createdDate";

export type SortDirection = "asc" | "desc";

/**
 * One sort key: which field to order by and in which direction. `direction` is
 * ignored when `field === 'none'`. The sort control shows and edits a query's
 * first key.
 */
export interface SortState {
  field: SortField;
  direction: SortDirection;
}

export const DEFAULT_SORT_STATE: SortState = {
  field: "none",
  direction: "asc",
};

/**
 * Human labels for the sort dropdown. Iteration order here is the order shown
 * in the UI, so 'none' comes first.
 */
export const SORT_FIELD_LABELS: Record<SortField, string> = {
  none: "No sorting",
  priority: "Priority",
  dueDate: "Due date",
  scheduledDate: "Scheduled date",
  startDate: "Start date",
  createdDate: "Created date",
};

/** Priority value used for tasks with no priority set (obsidian-tasks "None"). */
const NONE_PRIORITY = 3;

/**
 * Compare two tasks by the configured field, with the convention that "more
 * important / earlier" sorts first under ascending order:
 * - priority: 0 (Highest) … 5 (Lowest); `null` is treated as 3 (None).
 * - dates: earliest `YYYY-MM-DD` first.
 *
 * Returns a number < 0, 0, or > 0 for the present-vs-present case only. Tasks
 * missing the value are handled separately by {@link compareByKey} so they
 * always sink to the bottom regardless of direction.
 */
function compareField(a: Task, b: Task, field: SortField): number {
  if (field === "priority") {
    const pa = a.priority ?? NONE_PRIORITY;
    const pb = b.priority ?? NONE_PRIORITY;
    return pa - pb;
  }
  // Date fields: lexicographic compare works for ISO YYYY-MM-DD.
  const da = a[field as DateSortField] as string;
  const db = b[field as DateSortField] as string;
  return da < db ? -1 : da > db ? 1 : 0;
}

/**
 * Whether a task has a usable value for the given field. Missing values
 * (`null`/empty) are pushed to the end of the list in either direction.
 *
 * Note: priority always has a value (`null` folds into "None"), so every task
 * is considered present for priority sorting.
 */
function hasValue(task: Task, field: SortField): boolean {
  if (field === "priority" || field === "none") {
    return true;
  }
  const value = task[field];
  return value !== null && value !== undefined && value !== "";
}

/**
 * Compare two tasks by one sort key. Tasks lacking the key's value sink to the
 * bottom regardless of direction; two such tasks tie on this key.
 */
function compareByKey(a: Task, b: Task, key: SortState): number {
  const aHas = hasValue(a, key.field);
  const bHas = hasValue(b, key.field);

  // Missing values sink to the bottom in both directions.
  if (!aHas && !bHas) {
    return 0;
  }
  if (!aHas) {
    return 1;
  }
  if (!bHas) {
    return -1;
  }

  const dir = key.direction === "desc" ? -1 : 1;
  return compareField(a, b, key.field) * dir;
}

/**
 * Sort tasks by the given keys, returning a new array (never mutates the
 * input).
 *
 * - Keys apply in order, like consecutive Tasks `sort by` lines: a later key
 *   only orders tasks that tie on every earlier key.
 * - No keys (or only `'none'` keys): returns a shallow copy in the original
 *   order.
 * - Tasks lacking a key's value come last for that key, regardless of
 *   direction.
 * - Tasks that tie on every key fall back to a description compare so the
 *   order is stable across re-renders rather than reshuffling.
 */
export function sortTasks(tasks: Task[], keys: SortState[]): Task[] {
  const activeKeys = keys.filter((key) => key.field !== "none");
  if (activeKeys.length === 0) {
    return [...tasks];
  }

  return [...tasks].sort((a, b) => {
    for (const key of activeKeys) {
      const result = compareByKey(a, b, key);
      if (result !== 0) {
        return result;
      }
    }

    // Stable tiebreak: keep equal-keyed tasks in a deterministic order.
    return a.description.localeCompare(b.description, undefined, {
      sensitivity: "base",
    });
  });
}
