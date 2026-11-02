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
  folderOf,
  type GroupField,
  type GroupState,
} from "../utils/groupTasks";
import {
  parseDateFilter,
  matchesDateFilter,
  serializeDateFilter,
  type DateFilterInstruction,
} from "../utils/dateFilter";
import {
  evaluateBooleanExpression,
  isBooleanInstruction,
  parseBooleanExpression,
  type BooleanExpr,
} from "./booleanFilter";

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
 *   tag does not include #<tag>   (negation; the legacy `tag not includes`
 *     spelling still parses but is deprecated and warns)
 *   path includes <text> / path does not include <text>
 *   folder includes <text> / folder does not include <text>
 *   description includes <text>
 *   <date-field> <operator> <value>  (e.g., starts before tomorrow, due after 2026-07-10)
 *   (<filter>) OR (<filter>)  (Boolean combination of the filters above, with
 *     AND, OR, XOR, NOT, AND NOT, OR NOT and nesting, as in Tasks)
 *   sort by <due|scheduled|start|created|priority> [reverse]  (repeatable; as
 *     in Tasks, each later line orders the tasks that tie on the earlier ones)
 *   group by <status|priority|due|…|tags|folder|filename> [reverse]
 *
 * Any other line — including valid-but-unsupported Tasks instructions like
 * `filename includes …` or `priority is high` — is reported as an error by
 * {@link parseQuery} and ignored for filtering, so a query here always reads the
 * same as it would in Tasks.
 */
export interface BoardQuery {
  /** Filter instructions; tags are OR-ed together, description is AND-ed. */
  filters: FilterInstruction[];
  /**
   * Sort keys in query order; empty means no sorting. The sort bar shows and
   * edits the first key, reusing the same {@link SortState}.
   */
  sort: SortState[];
  /** Swimlane grouping, reusing the {@link GroupState} the group bar produces. */
  group: GroupState;
}

/**
 * A single supported filter line. Tag values are stored bare (no leading `#`);
 * description matching is case-insensitive substring. Tag, path, and folder
 * filters can be negated (`… does not include …`), meaning a task must NOT
 * match. Path filters match the full file path; folder filters match the
 * containing folder (both case-insensitive substring, mirroring Tasks).
 * Date filters support operators like before, after, on, in, has, no.
 * A Boolean filter combines simple filters on one line; each operand matches
 * on its own, without the OR-within-kind grouping applied across lines.
 */
export type FilterInstruction =
  SimpleFilterInstruction | BooleanFilterInstruction;

/** A filter that fits on its own line, without Boolean operators. */
export type SimpleFilterInstruction =
  | { kind: "tag"; value: string; negated?: boolean }
  | { kind: "path"; value: string; negated?: boolean }
  | { kind: "folder"; value: string; negated?: boolean }
  | { kind: "description"; value: string }
  | DateFilterInstruction;

/** A Boolean combination of simple filters, e.g. `(due today) OR (no due date)`. */
export interface BooleanFilterInstruction {
  kind: "boolean";
  expr: BooleanExpr<SimpleFilterInstruction>;
}

/** An empty query: no filters, no sorting, no grouping. */
export const EMPTY_QUERY: BoardQuery = {
  filters: [],
  sort: [],
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
  "supported: tag includes #<tag>, tag does not include #<tag>, path includes <text>, path does not include <text>, folder includes <text>, folder does not include <text>, description includes <text>, <date-field> <operator> <value> (e.g., starts before tomorrow), (<filter>) OR (<filter>), sort by <due|scheduled|start|created|priority> [reverse], group by <status|priority|tags|path|folder|filename> [reverse]";

/**
 * Parse a multi-line query string into a {@link BoardQuery}. One instruction per
 * line; blank lines are ignored. Parsing is tolerant: an unrecognised or
 * unsupported line is skipped and recorded in `errors` (with its 1-based line
 * number) so the modal can surface feedback without discarding the whole query.
 * Deprecated-but-working spellings are recorded in `warnings`.
 */
export function parseQuery(input: string): {
  query: BoardQuery;
  errors: string[];
  warnings: string[];
} {
  const filters: FilterInstruction[] = [];
  const sort: SortState[] = [];
  let group: GroupState = { ...DEFAULT_GROUP_STATE };
  const errors: string[] = [];
  const warnings: string[] = [];

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
    if (result.warning) {
      warnings.push(`Line ${index + 1}: ${result.warning}`);
    }
    if (result.sort) {
      sort.push(result.sort);
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

  return { query: { filters, sort, group }, errors, warnings };
}

/** Parse one already-trimmed, non-empty line. */
function parseLine(line: string): {
  filter?: FilterInstruction;
  sort?: SortState;
  group?: GroupState;
  error?: string;
  warning?: string;
} {
  // (<filter>) OR (<filter>) — Boolean combination of filters
  if (isBooleanInstruction(line)) {
    return parseBooleanLine(line);
  }

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

  // Try to parse as a date filter first (before tag filters)
  const dateFilter = parseDateFilter(line);
  if (dateFilter) {
    return { filter: dateFilter };
  }

  // <field> does not include <text> — canonical negation (Tasks' spelling)
  const negationMatch =
    /^(tag|path|folder)\s+does\s+not\s+include\s+(.+)$/i.exec(line);
  if (negationMatch) {
    return buildFieldFilter(negationMatch[1], negationMatch[2], true);
  }

  // <field> not includes <text> — legacy negation, deprecated
  const legacyMatch = /^(tag|path|folder)\s+not\s+includes\s+(.+)$/i.exec(line);
  if (legacyMatch) {
    const result = buildFieldFilter(legacyMatch[1], legacyMatch[2], true);
    if (result.error) {
      return result;
    }
    return {
      ...result,
      warning:
        '"not includes" is deprecated, use "does not include" (support will be removed in a future version)',
    };
  }

  // <field> includes <text>
  const includesMatch = /^(tag|path|folder)\s+includes\s+(.+)$/i.exec(line);
  if (includesMatch) {
    return buildFieldFilter(includesMatch[1], includesMatch[2], false);
  }

  // description includes <text>
  const descMatch = /^description\s+includes\s+(.+)$/i.exec(line);
  if (descMatch) {
    return { filter: { kind: "description", value: descMatch[1].trim() } };
  }

  return { error: `unsupported instruction "${line}" (${SUPPORTED_SYNTAX})` };
}

/**
 * Parse a Boolean instruction. Operands are parsed as standalone lines, so any
 * supported filter can be combined; sort and group instructions cannot.
 */
function parseBooleanLine(line: string): {
  filter?: FilterInstruction;
  error?: string;
  warning?: string;
} {
  const result = parseBooleanExpression<SimpleFilterInstruction>(
    line,
    (text) => {
      if (isBooleanInstruction(text)) {
        return {
          error: `delimiters cannot be mixed in a Boolean instruction: "${text}"`,
        };
      }
      const leaf = parseLine(text);
      if (leaf.error) {
        return { error: leaf.error };
      }
      if (!leaf.filter || leaf.filter.kind === "boolean") {
        return {
          error: `only filters can be combined in a Boolean instruction: "${text}"`,
        };
      }
      return { filter: leaf.filter, warning: leaf.warning };
    },
  );

  if (result.error !== undefined || !result.expr) {
    return {
      error: `invalid Boolean instruction: ${result.error ?? "empty expression"}`,
    };
  }
  return {
    filter: { kind: "boolean", expr: result.expr },
    warning:
      result.warnings.length > 0 ? result.warnings.join("; ") : undefined,
  };
}

/**
 * Build a tag/path/folder filter from its raw parts. Tags are normalized bare
 * (no leading `#`); path/folder values are trimmed. An empty value errors.
 */
function buildFieldFilter(
  field: string,
  rawValue: string,
  negated: boolean,
): { filter?: FilterInstruction; error?: string } {
  const value = rawValue.trim();
  const negation = negated ? { negated: true } : {};
  if (field === "tag") {
    const tag = normalizeTag(value);
    if (tag === "") {
      return { error: "empty tag" };
    }
    return { filter: { kind: "tag", value: tag, ...negation } };
  }
  if (value === "") {
    return { error: `empty ${field} value` };
  }
  return {
    filter: {
      kind: field as "path" | "folder",
      value,
      ...negation,
    },
  };
}

/**
 * Serialize a {@link BoardQuery} back to a canonical, one-instruction-per-line
 * string in reference-exact Tasks syntax. Filters are emitted in array order,
 * then the sort keys in order. `parseQuery(serializeQuery(q))` yields an
 * equivalent query.
 */
export function serializeQuery(query: BoardQuery): string {
  const lines = query.filters.map(serializeFilter);

  for (const key of query.sort) {
    const sortKeyword = SORT_FIELD_TO_KEYWORD[key.field];
    if (sortKeyword) {
      const reverse = key.direction === "desc" ? " reverse" : "";
      lines.push(`sort by ${sortKeyword}${reverse}`);
    }
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
    case "boolean":
      return serializeBooleanFilter(filter.expr);
    case "tag":
    case "path":
    case "folder":
    case "description":
    case "date":
      return serializeSimpleFilter(filter);
  }
}

/** Opening delimiter → closing delimiter, in serialization preference order. */
const BOOLEAN_DELIMITERS: Array<[string, string]> = [
  ["(", ")"],
  ["[", "]"],
  ["{", "}"],
  ['"', '"'],
];

/**
 * Serialize a Boolean expression in Tasks syntax.
 *
 * Delimiters are picked so the line parses back to the same expression,
 * preferring, in order:
 * 1. a pair absent from every operand, so the line is valid in Tasks too
 *    (Tasks does not balance delimiters inside operands);
 * 2. a pair every operand contains only balanced, which this parser accepts.
 *
 * Mixed operators are grouped explicitly, as Tasks recommends, unless that
 * would need nested groups with `"` (which cannot nest); precedence-only
 * grouping is used then. Any parsed expression can be serialized this way.
 */
function serializeBooleanFilter(
  expr: BooleanExpr<SimpleFilterInstruction>,
): string {
  const leaves = collectLeaves(expr).map(serializeSimpleFilter);

  for (const strict of [true, false]) {
    for (const explicit of [true, false]) {
      for (const [open, close] of BOOLEAN_DELIMITERS) {
        const usable =
          open === close
            ? !leaves.some((text) => text.includes(open)) &&
              !needsNesting(expr, explicit)
            : leaves.every((text) =>
                strict
                  ? !text.includes(open) && !text.includes(close)
                  : isBalanced(text, open, close),
              );
        if (usable) {
          return formatBooleanExpr(expr, open, close, explicit);
        }
      }
    }
  }
  return formatBooleanExpr(expr, "(", ")", true);
}

const BOOLEAN_PRECEDENCE = { or: 1, and: 2, xor: 3 } as const;

/** Whether `child` needs its own group to keep its place under `parent`. */
function needsGroup<T>(
  child: BooleanExpr<T>,
  parent: BooleanExpr<T>,
  side: "left" | "right",
  explicit: boolean,
): boolean {
  if (child.op === "leaf" || child.op === "not") {
    return false;
  }
  if (parent.op === "not") {
    return true;
  }
  if (parent.op === "leaf") {
    return false;
  }
  if (explicit) {
    return side === "right" || child.op !== parent.op;
  }
  const childPrecedence = BOOLEAN_PRECEDENCE[child.op];
  const parentPrecedence = BOOLEAN_PRECEDENCE[parent.op];
  return side === "left"
    ? childPrecedence < parentPrecedence
    : childPrecedence <= parentPrecedence;
}

function formatBooleanExpr(
  expr: BooleanExpr<SimpleFilterInstruction>,
  open: string,
  close: string,
  explicit: boolean,
): string {
  const format = (node: BooleanExpr<SimpleFilterInstruction>): string => {
    const child = (
      sub: BooleanExpr<SimpleFilterInstruction>,
      side: "left" | "right",
    ): string =>
      needsGroup(sub, node, side, explicit)
        ? `${open}${format(sub)}${close}`
        : format(sub);

    switch (node.op) {
      case "leaf":
        return `${open}${serializeSimpleFilter(node.filter)}${close}`;
      case "not":
        return `NOT ${child(node.operand, "right")}`;
      default:
        return `${child(node.left, "left")} ${node.op.toUpperCase()} ${child(node.right, "right")}`;
    }
  };
  return format(expr);
}

/** Whether serializing needs a group inside a group (impossible with `"`). */
function needsNesting<T>(expr: BooleanExpr<T>, explicit: boolean): boolean {
  switch (expr.op) {
    case "leaf":
      return false;
    case "not":
      return (
        needsGroup(expr.operand, expr, "right", explicit) ||
        needsNesting(expr.operand, explicit)
      );
    default:
      return (
        needsGroup(expr.left, expr, "left", explicit) ||
        needsGroup(expr.right, expr, "right", explicit) ||
        needsNesting(expr.left, explicit) ||
        needsNesting(expr.right, explicit)
      );
  }
}

/** Whether `text` holds only balanced, properly ordered `open`/`close` pairs. */
function isBalanced(text: string, open: string, close: string): boolean {
  let depth = 0;
  for (const char of text) {
    if (char === open) {
      depth++;
    } else if (char === close && --depth < 0) {
      return false;
    }
  }
  return depth === 0;
}

function collectLeaves<T>(expr: BooleanExpr<T>): T[] {
  switch (expr.op) {
    case "leaf":
      return [expr.filter];
    case "not":
      return collectLeaves(expr.operand);
    default:
      return [...collectLeaves(expr.left), ...collectLeaves(expr.right)];
  }
}

function serializeSimpleFilter(filter: SimpleFilterInstruction): string {
  switch (filter.kind) {
    case "tag":
      return filter.negated
        ? `tag does not include #${filter.value}`
        : `tag includes #${filter.value}`;
    case "path":
    case "folder":
      return filter.negated
        ? `${filter.kind} does not include ${filter.value}`
        : `${filter.kind} includes ${filter.value}`;
    case "description":
      return `description includes ${filter.value}`;
    case "date":
      return serializeDateFilter(filter);
  }
}

/** Whether a sort is the default (no explicit `sort by`). */
export function isDefaultSort(sort: SortState[]): boolean {
  return sort.length === 0;
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
 * The overlay's sort keys replace the base keys as a whole.
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
 * Apply filter instructions: positive instructions of the same kind are OR-ed
 * together (a task matches if it carries any selected tag, or lives under any
 * included path/folder — mirroring the tag bar's multi-select), negative
 * instructions are AND-ed on top (a task must match no excluded value), and
 * instructions of different kinds are AND-ed together. Date filters are AND-ed
 * with all other filters.
 *
 * Path filters match the full file path, folder filters the containing folder
 * (parent prefix with trailing `/`); both are case-insensitive substring
 * matches, mirroring Tasks. A task without a location matches no positive
 * filter (excluded) and no negated filter (retained).
 *
 * Note: this OR-within-kind differs from Tasks, where two `tag includes` lines
 * AND. It preserves the existing tag-filter UX; see NOTES.md.
 */
function filterTasks(tasks: Task[], filters: FilterInstruction[]): Task[] {
  if (filters.length === 0) {
    return [...tasks];
  }

  const includeTags = new Set(
    filters
      .filter(
        (f): f is Extract<FilterInstruction, { kind: "tag" }> =>
          f.kind === "tag" && !f.negated,
      )
      .map((f) => f.value),
  );

  const excludeTags = new Set(
    filters
      .filter(
        (f): f is Extract<FilterInstruction, { kind: "tag" }> =>
          f.kind === "tag" && f.negated === true,
      )
      .map((f) => f.value),
  );

  const descriptions = filters
    .filter(
      (f): f is Extract<FilterInstruction, { kind: "description" }> =>
        f.kind === "description",
    )
    .map((f) => f.value.toLowerCase());

  const dateFilters = filters.filter(
    (f): f is DateFilterInstruction => f.kind === "date",
  );

  const booleanFilters = filters.filter(
    (f): f is BooleanFilterInstruction => f.kind === "boolean",
  );

  const now = new Date();

  const partitionValues = (
    kind: "path" | "folder",
    negated: boolean,
  ): string[] =>
    filters
      .filter(
        (f): f is Extract<FilterInstruction, { kind: "path" | "folder" }> =>
          f.kind === kind && Boolean(f.negated) === negated,
      )
      .map((f) => f.value.toLowerCase());

  const includePaths = partitionValues("path", false);
  const excludePaths = partitionValues("path", true);
  const includeFolders = partitionValues("folder", false);
  const excludeFolders = partitionValues("folder", true);

  return tasks.filter((task) => {
    const taskTags = (task.tags ?? []).map(normalizeTag);

    const rawPath = task.taskLocation?.path ?? "";
    const taskPath = rawPath.toLowerCase();
    const taskFolder = rawPath ? folderOf(rawPath).toLowerCase() : "";

    // Positive tags (includes): OR'd — task must have at least one.
    if (includeTags.size > 0) {
      if (!taskTags.some((tag) => includeTags.has(tag))) {
        return false;
      }
    }

    // Negative tags (does not include): AND'd — task must have none.
    if (excludeTags.size > 0) {
      if (taskTags.some((tag) => excludeTags.has(tag))) {
        return false;
      }
    }

    // Paths and folders: positive OR'd within their kind, negations AND'd,
    // and the two kinds AND'd together.
    if (
      includePaths.length > 0 &&
      !includePaths.some((value) => taskPath.includes(value))
    ) {
      return false;
    }
    if (excludePaths.some((value) => taskPath.includes(value))) {
      return false;
    }
    if (
      includeFolders.length > 0 &&
      !includeFolders.some((value) => taskFolder.includes(value))
    ) {
      return false;
    }
    if (excludeFolders.some((value) => taskFolder.includes(value))) {
      return false;
    }

    // Description: AND'd — case-insensitive substring match.
    const description = task.description.toLowerCase();
    if (!descriptions.every((text) => description.includes(text))) {
      return false;
    }

    // Date filters: AND'd — all must match
    for (const dateFilter of dateFilters) {
      if (!matchesDateFilter(task, dateFilter, now)) {
        return false;
      }
    }

    // Boolean filters: AND'd — each line must evaluate to true
    return booleanFilters.every((f) =>
      evaluateBooleanExpression(f.expr, (leaf) =>
        matchesSimpleFilter(task, leaf, now),
      ),
    );
  });
}

/**
 * Whether a task matches one simple filter on its own — the same result
 * {@link filterTasks} gives for a query made of that single line.
 */
function matchesSimpleFilter(
  task: Task,
  filter: SimpleFilterInstruction,
  now: Date,
): boolean {
  switch (filter.kind) {
    case "tag": {
      const hasTag = (task.tags ?? []).map(normalizeTag).includes(filter.value);
      return filter.negated ? !hasTag : hasTag;
    }
    case "path":
    case "folder": {
      const rawPath = task.taskLocation?.path ?? "";
      const haystack = (
        filter.kind === "path" ? rawPath : rawPath ? folderOf(rawPath) : ""
      ).toLowerCase();
      const found = haystack.includes(filter.value.toLowerCase());
      return filter.negated ? !found : found;
    }
    case "description":
      return task.description
        .toLowerCase()
        .includes(filter.value.toLowerCase());
    case "date":
      return matchesDateFilter(task, filter, now);
  }
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
  const trimmed = String(title).trim();
  if (trimmed !== "") {
    filters.push({ kind: "description", value: trimmed });
  }
  return { ...query, filters };
}

/** Bare tag names currently selected as positive (include) filters, in query order. */
export function getTags(query: BoardQuery): string[] {
  return query.filters
    .filter(
      (f): f is Extract<FilterInstruction, { kind: "tag" }> =>
        f.kind === "tag" && !f.negated,
    )
    .map((f) => f.value);
}

/** Bare tag names currently selected as negative (exclude) filters, in query order. */
export function getExcludedTags(query: BoardQuery): string[] {
  return query.filters
    .filter(
      (f): f is Extract<FilterInstruction, { kind: "tag" }> =>
        f.kind === "tag" && f.negated === true,
    )
    .map((f) => f.value);
}

/** Replace the tag include slice; description, sort, and excluded tags are preserved. */
export function withTags(query: BoardQuery, tags: string[]): BoardQuery {
  const filters: FilterInstruction[] = query.filters.filter(
    (f) => !(f.kind === "tag" && f.negated !== true),
  );
  for (const tag of tags) {
    filters.push({ kind: "tag", value: normalizeTag(tag) });
  }
  return { ...query, filters };
}

/** Replace the tag exclude slice; description, sort, and included tags are preserved. */
export function withExcludedTags(
  query: BoardQuery,
  tags: string[],
): BoardQuery {
  const filters: FilterInstruction[] = query.filters.filter(
    (f) => !(f.kind === "tag" && f.negated),
  );
  for (const tag of tags) {
    filters.push({ kind: "tag", value: normalizeTag(tag), negated: true });
  }
  return { ...query, filters };
}

/** The sort slice the sort bar shows: the first sort key. */
export function getSort(query: BoardQuery): SortState {
  return query.sort[0] ?? { ...DEFAULT_SORT_STATE };
}

/**
 * Replace the first sort key; filters and the later keys are preserved, except
 * a later key on the same field, which the new first key makes redundant.
 * `'none'` clears every key, so "No sorting" in the bar means no sorting.
 */
export function withSort(query: BoardQuery, sort: SortState): BoardQuery {
  if (sort.field === "none") {
    return { ...query, sort: [] };
  }
  const laterKeys = query.sort
    .slice(1)
    .filter((key) => key.field !== sort.field);
  return { ...query, sort: [{ ...sort }, ...laterKeys] };
}

/** The group slice. */
export function getGroup(query: BoardQuery): GroupState {
  return query.group;
}

/** Replace the group slice; filters and sort are preserved. */
export function withGroup(query: BoardQuery, group: GroupState): BoardQuery {
  return { ...query, group: { ...group } };
}
