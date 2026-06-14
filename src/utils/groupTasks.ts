import type { Task } from "../services/TasksIntegration";
import type { SortDirection } from "./sortTasks";

/**
 * A field the board can be grouped into swimlanes by. `'none'` yields a single
 * lane containing every task in the order it arrived (the default).
 *
 * A deliberately small, structured subset of the Obsidian Tasks `group by`
 * fields (https://publish.obsidian.md/tasks/Queries/Grouping). `group by
 * function` (arbitrary JS) is intentionally not supported.
 */
export type GroupField =
  | "none"
  | "status"
  | "priority"
  | "tags"
  | "path"
  | "folder"
  | "filename";

/**
 * The state of the group control: which field to split lanes by and whether to
 * reverse the heading order. `direction` is ignored when `field === 'none'`.
 */
export interface GroupState {
  field: GroupField;
  direction: SortDirection;
}

export const DEFAULT_GROUP_STATE: GroupState = {
  field: "none",
  direction: "asc",
};

/**
 * Human labels for the group dropdown. Iteration order here is the order shown
 * in the UI, so 'none' comes first.
 */
export const GROUP_FIELD_LABELS: Record<GroupField, string> = {
  none: "No grouping",
  status: "Status",
  priority: "Priority",
  tags: "Tags",
  path: "Path",
  folder: "Folder",
  filename: "Filename",
};

/** A single swimlane: a stable key, a display label, and its tasks. */
export interface TaskGroup {
  key: string;
  label: string;
  tasks: Task[];
}

/** Sentinel key/label for the single lane produced when grouping is off. */
const ALL_KEY = "__all__";
/** Label used for tasks missing a value for the grouped field. */
const NONE_LABEL = "None";

const PRIORITY_LABELS: Record<number, string> = {
  0: "Highest",
  1: "High",
  2: "Medium",
  3: "None",
  4: "Low",
  5: "Lowest",
};

/** The path's parent folder, always ending in `/` (root → `/`). */
function folderOf(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "/" : path.slice(0, slash + 1);
}

/** The file name without its `.md` extension. */
function filenameOf(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  return base.replace(/\.md$/i, "");
}

/**
 * Produce the group labels a task belongs to for the given field. Most fields
 * yield exactly one label; `tags` yields one per tag (so a multi-tag task lands
 * in several lanes, mirroring Tasks). An empty array means "missing value" and
 * folds the task into the `None` lane.
 */
function labelsFor(task: Task, field: GroupField): string[] {
  switch (field) {
    case "status":
      return [task.status.name || task.status.type];
    case "priority":
      return [PRIORITY_LABELS[task.priority ?? 3]];
    case "tags":
      return task.tags && task.tags.length > 0 ? [...task.tags] : [];
    case "path":
      return task.taskLocation?.path ? [task.taskLocation.path] : [];
    case "folder":
      return task.taskLocation?.path ? [folderOf(task.taskLocation.path)] : [];
    case "filename":
      return task.taskLocation?.path
        ? [filenameOf(task.taskLocation.path)]
        : [];
    default:
      return [];
  }
}

/**
 * Group tasks into swimlanes by the given state, returning a new array (never
 * mutates the input). Grouping is expected to run *after* filtering and sorting.
 *
 * - `field === 'none'`: a single unlabeled lane in the original order.
 * - Tasks missing the value collect under a `None` lane, always shown last.
 * - Lanes are ordered by label; `direction: 'desc'` reverses that order (the
 *   `None` lane stays last either way). Within a lane, the incoming task order
 *   (i.e. the applied sort) is preserved.
 */
export function groupTasks(tasks: Task[], state: GroupState): TaskGroup[] {
  if (state.field === "none") {
    return [{ key: ALL_KEY, label: "", tasks: [...tasks] }];
  }

  const groups = new Map<string, TaskGroup>();
  let none: TaskGroup | null = null;

  for (const task of tasks) {
    const labels = labelsFor(task, state.field);
    if (labels.length === 0) {
      if (!none) {
        none = { key: NONE_LABEL, label: NONE_LABEL, tasks: [] };
      }
      none.tasks.push(task);
      continue;
    }
    for (const label of labels) {
      let group = groups.get(label);
      if (!group) {
        group = { key: label, label, tasks: [] };
        groups.set(label, group);
      }
      group.tasks.push(task);
    }
  }

  const ordered = [...groups.values()].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true }),
  );
  if (state.direction === "desc") {
    ordered.reverse();
  }
  if (none) {
    ordered.push(none);
  }
  return ordered;
}
