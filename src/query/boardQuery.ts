import type { Task } from "../services/TasksIntegration";
import { normalizeTag } from "../utils/searchFilter";
import {
  DEFAULT_SORT_STATE,
  sortTasks,
  type SortDirection,
  type SortField,
  type SortState,
} from "../utils/sortTasks";
import {
  DEFAULT_GROUP_STATE,
  type GroupField,
  type GroupState,
} from "../utils/groupTasks";

/**
 * The canonical, line-based query that drives a board's filtering and sorting.
 *
 * It is the single source of truth: the search/sort bars edit known slices of it
 * (tags, title, sort). The query modal lets users edit the raw string directly.
 *
 * The supported syntax is a deliberately small, **reference-exact** subset of the
 * Obsidian Tasks query language (https://publish.obsidian.md/tasks/Quick+Reference)
 * — only the instructions the bars themselves produce:
 *
 *   tag includes #<tag>
 *   description includes <text>
 *   sort by <due|scheduled|start|created|priority> [reverse]
 *   group by <status|priority|due|…|tags|folder|filename> [reverse]
 *
 * Any other line — including valid-but-unsupported Tasks instructions like
 * `path includes …` or `priority is high` — is reported as an error by
 * {@link parseQuery} and ignored for filtering, so a query here always reads the
 * same as it would in Tasks.
 */
export interface BoardQuery {
  /** Filter instructions; tags are OR-ed together, description is AND-ed. */
  filters: FilterInstruction[];
  /** Ordering, reusing the same {@link SortState} the sort bar produces. */
  sort: SortState;
  /** Swimlane grouping, reusing the {@link GroupState} the group bar produces. */
  group: GroupState;
}

/**
 * A single supported filter line. Tag values are stored bare (no leading `#`);
 * description matching is case-insensitive substring.
 */
export type FilterInstruction =
  | { kind: "tag"; value: string }
  | { kind: "description"; value: string };

/** An empty query: no filters, no sorting, no grouping. */
export const EMPTY_QUERY: BoardQuery = {
  filters: [],
  sort: { ...DEFAULT_SORT_STATE },
  group: { ...DEFAULT_GROUP_STATE },
};

/**
 * Maps the Tasks `sort by` keyword to our internal {@link SortField}. Note Tasks
 * spells the start-date sort keyword `start` (the date *filter* keyword is
 * `starts`, but we don't support date filters).
 */
const SORT_KEYWORD_TO_FIELD: Record<string, SortField> = {
  priority: "priority",
  due: "dueDate",
  scheduled: "scheduledDate",
  start: "startDate",
  created: "createdDate",
};

/** Inverse of {@link SORT_KEYWORD_TO_FIELD}, for serialization. */
const SORT_FIELD_TO_KEYWORD: Partial<Record<SortField, string>> = {
  priority: "priority",
  dueDate: "due",
  scheduledDate: "scheduled",
  startDate: "start",
  createdDate: "created",
};

/** Maps the Tasks `group by` keyword to our internal {@link GroupField}. */
// Date-based grouping is intentionally unsupported: one lane per distinct date
// scatters the board. Group fields are limited to low-cardinality dimensions.
const GROUP_KEYWORD_TO_FIELD: Record<string, GroupField> = {
  status: "status",
  priority: "priority",
  tags: "tags",
  path: "path",
  folder: "folder",
  filename: "filename",
};

/** Inverse of {@link GROUP_KEYWORD_TO_FIELD}, for serialization. */
const GROUP_FIELD_TO_KEYWORD: Partial<Record<GroupField, string>> = {
  status: "status",
  priority: "priority",
  tags: "tags",
  path: "path",
  folder: "folder",
  filename: "filename",
};

/** One-line summary of the supported syntax, used in error messages. */
const SUPPORTED_SYNTAX =
  "supported: tag includes #<tag>, description includes <text>, sort by <due|scheduled|start|created|priority> [reverse], group by <status|priority|tags|path|folder|filename> [reverse]";

/**
 * Parse a multi-line query string into a {@link BoardQuery}. One instruction per
 * line; blank lines are ignored. Parsing is tolerant: an unrecognised or
 * unsupported line is skipped and recorded in `errors` (with its 1-based line
 * number) so the modal can surface feedback without discarding the whole query.
 */
export function parseQuery(input: string): {
  query: BoardQuery;
  errors: string[];
} {
  const filters: FilterInstruction[] = [];
  let sort: SortState = { ...DEFAULT_SORT_STATE };
  let group: GroupState = { ...DEFAULT_GROUP_STATE };
  const errors: string[] = [];

  const lines = input.split("\n");
  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (line === "") {
      return;
    }

    const result = parseLine(line);
    if (result.error) {
      errors.push(`Line ${index + 1}: ${result.error}`);
      return;
    }
    if (result.sort) {
      sort = result.sort;
      return;
    }
    if (result.group) {
      group = result.group;
      return;
    }
    if (result.filter) {
      filters.push(result.filter);
    }
  });

  return { query: { filters, sort, group }, errors };
}

/** Parse one already-trimmed, non-empty line. */
function parseLine(line: string): {
  filter?: FilterInstruction;
  sort?: SortState;
  group?: GroupState;
  error?: string;
} {
  // sort by <field> [reverse]
  const sortMatch = /^sort\s+by\s+(\S+)(?:\s+(reverse))?$/i.exec(line);
  if (sortMatch) {
    const field = SORT_KEYWORD_TO_FIELD[sortMatch[1].toLowerCase()];
    if (!field) {
      return {
        error: `unknown sort field "${sortMatch[1]}" (${SUPPORTED_SYNTAX})`,
      };
    }
    const direction: SortDirection = sortMatch[2] ? "desc" : "asc";
    return { sort: { field, direction } };
  }

  // group by <field> [reverse]
  const groupMatch = /^group\s+by\s+(\S+)(?:\s+(reverse))?$/i.exec(line);
  if (groupMatch) {
    const field = GROUP_KEYWORD_TO_FIELD[groupMatch[1].toLowerCase()];
    if (!field) {
      return {
        error: `unknown group field "${groupMatch[1]}" (${SUPPORTED_SYNTAX})`,
      };
    }
    const direction: SortDirection = groupMatch[2] ? "desc" : "asc";
    return { group: { field, direction } };
  }

  // tag includes <tag>
  const tagMatch = /^tag\s+includes\s+(.+)$/i.exec(line);
  if (tagMatch) {
    const value = normalizeTag(tagMatch[1].trim());
    if (value === "") {
      return { error: "empty tag" };
    }
    return { filter: { kind: "tag", value } };
  }

  // description includes <text>
  const descMatch = /^description\s+includes\s+(.+)$/i.exec(line);
  if (descMatch) {
    return { filter: { kind: "description", value: descMatch[1].trim() } };
  }

  return { error: `unsupported instruction "${line}" (${SUPPORTED_SYNTAX})` };
}

/**
 * Serialize a {@link BoardQuery} back to a canonical, one-instruction-per-line
 * string in reference-exact Tasks syntax. Filters are emitted in array order; a
 * non-default sort is emitted last. `parseQuery(serializeQuery(q))` yields an
 * equivalent query.
 */
export function serializeQuery(query: BoardQuery): string {
  const lines = query.filters.map(serializeFilter);

  const sortKeyword = SORT_FIELD_TO_KEYWORD[query.sort.field];
  if (sortKeyword) {
    const reverse = query.sort.direction === "desc" ? " reverse" : "";
    lines.push(`sort by ${sortKeyword}${reverse}`);
  }

  const groupKeyword = GROUP_FIELD_TO_KEYWORD[query.group.field];
  if (groupKeyword) {
    const reverse = query.group.direction === "desc" ? " reverse" : "";
    lines.push(`group by ${groupKeyword}${reverse}`);
  }

  return lines.join("\n");
}

function serializeFilter(filter: FilterInstruction): string {
  switch (filter.kind) {
    case "tag":
      return `tag includes #${filter.value}`;
    case "description":
      return `description includes ${filter.value}`;
  }
}

/** Whether a sort state is the default (no explicit `sort by`). */
export function isDefaultSort(sort: SortState): boolean {
  return (
    sort.field === DEFAULT_SORT_STATE.field &&
    sort.direction === DEFAULT_SORT_STATE.direction
  );
}

/** Whether a group state is the default (no explicit `group by`). */
export function isDefaultGroup(group: GroupState): boolean {
  return (
    group.field === DEFAULT_GROUP_STATE.field &&
    group.direction === DEFAULT_GROUP_STATE.direction
  );
}

/**
 * Merge a shared base query with a view's overlay query. Filters concatenate
 * (base first), so the merge reads exactly like typing the base lines followed
 * by the overlay lines — tags stay OR-ed, descriptions AND-ed. The overlay's
 * sort/group each win unless default, in which case the base value applies.
 */
export function mergeQueries(
  base: BoardQuery,
  overlay: BoardQuery,
): BoardQuery {
  return {
    filters: [...base.filters, ...overlay.filters],
    sort: isDefaultSort(overlay.sort) ? base.sort : overlay.sort,
    group: isDefaultGroup(overlay.group) ? base.group : overlay.group,
  };
}

/**
 * Apply a query to a list of tasks: filter, then sort. Returns a new array and
 * never mutates the input. Sorting is delegated to {@link sortTasks}.
 */
export function applyBoardQuery(tasks: Task[], query: BoardQuery): Task[] {
  const filtered = filterTasks(tasks, query.filters);
  return sortTasks(filtered, query.sort);
}

/**
 * Apply filter instructions: tag instructions are OR-ed together (a task matches
 * if it carries any selected tag — mirroring the tag bar's multi-select), and the
 * description instruction is AND-ed on top.
 *
 * Note: this OR-within-tags differs from Tasks, where two `tag includes` lines
 * AND. It preserves the existing tag-filter UX; see NOTES.md.
 */
function filterTasks(tasks: Task[], filters: FilterInstruction[]): Task[] {
  if (filters.length === 0) {
    return [...tasks];
  }

  const tagSet = new Set(
    filters
      .filter(
        (f): f is Extract<FilterInstruction, { kind: "tag" }> =>
          f.kind === "tag",
      )
      .map((f) => f.value),
  );
  const descriptions = filters
    .filter(
      (f): f is Extract<FilterInstruction, { kind: "description" }> =>
        f.kind === "description",
    )
    .map((f) => f.value.toLowerCase());

  return tasks.filter((task) => {
    if (tagSet.size > 0) {
      const taskTags = (task.tags ?? []).map(normalizeTag);
      if (!taskTags.some((tag) => tagSet.has(tag))) {
        return false;
      }
    }
    const description = task.description.toLowerCase();
    return descriptions.every((text) => description.includes(text));
  });
}

// --- Slice accessors: let the bars read/replace their part of the query without
// --- disturbing the rest. ---

/** The title bar owns the (single) description filter. */
export function getTitle(query: BoardQuery): string {
  const desc = query.filters.find((f) => f.kind === "description");
  return desc ? desc.value : "";
}

/** Replace the description slice; tags and sort are preserved. */
export function withTitle(query: BoardQuery, title: string): BoardQuery {
  const filters: FilterInstruction[] = query.filters.filter(
    (f) => f.kind !== "description",
  );
  const trimmed = title.trim();
  if (trimmed !== "") {
    filters.push({ kind: "description", value: trimmed });
  }
  return { ...query, filters };
}

/** Bare tag names currently selected, in query order. */
export function getTags(query: BoardQuery): string[] {
  return query.filters
    .filter(
      (f): f is Extract<FilterInstruction, { kind: "tag" }> => f.kind === "tag",
    )
    .map((f) => f.value);
}

/** Replace the tag slice; description and sort are preserved. */
export function withTags(query: BoardQuery, tags: string[]): BoardQuery {
  const filters: FilterInstruction[] = query.filters.filter(
    (f) => f.kind !== "tag",
  );
  for (const tag of tags) {
    filters.push({ kind: "tag", value: normalizeTag(tag) });
  }
  return { ...query, filters };
}

/** The sort slice. */
export function getSort(query: BoardQuery): SortState {
  return query.sort;
}

/** Replace the sort slice; filters are preserved. */
export function withSort(query: BoardQuery, sort: SortState): BoardQuery {
  return { ...query, sort: { ...sort } };
}

/** The group slice. */
export function getGroup(query: BoardQuery): GroupState {
  return query.group;
}

/** Replace the group slice; filters and sort are preserved. */
export function withGroup(query: BoardQuery, group: GroupState): BoardQuery {
  return { ...query, group: { ...group } };
}
