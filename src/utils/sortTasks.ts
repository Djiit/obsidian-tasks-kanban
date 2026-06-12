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
 * The state of the sort control: which field to order by and in which
 * direction. `direction` is ignored when `field === 'none'`.
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
 * missing the value are handled separately by {@link sortTasks} so they always
 * sink to the bottom regardless of direction.
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
 * Sort tasks by the given state, returning a new array (never mutates the
 * input).
 *
 * - `field === 'none'`: returns a shallow copy in the original order.
 * - Tasks lacking the sort value always come last, regardless of direction.
 * - Equal keys fall back to a description compare so the order is stable across
 *   re-renders rather than reshuffling.
 */
export function sortTasks(tasks: Task[], state: SortState): Task[] {
  if (state.field === "none") {
    return [...tasks];
  }

  const field = state.field;
  const dir = state.direction === "desc" ? -1 : 1;

  return [...tasks].sort((a, b) => {
    const aHas = hasValue(a, field);
    const bHas = hasValue(b, field);

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

    const primary = compareField(a, b, field) * dir;
    if (primary !== 0) {
      return primary;
    }

    // Stable tiebreak: keep equal-keyed tasks in a deterministic order.
    return a.description.localeCompare(b.description, undefined, {
      sensitivity: "base",
    });
  });
}
