import type { Task } from "../services/TasksIntegration";

/**
 * A single metadata badge shown on a card.
 *
 * `modifier` is appended to the base CSS class as
 * `tasks-kanban-card-chip-${modifier}` so styles.css can colour each variant.
 * `title` is an optional tooltip (e.g. resolved dependency descriptions).
 */
export interface Chip {
  emoji: string;
  label: string;
  modifier: string;
  title?: string;
}

/**
 * Status types that count as "closed" for dependency/overdue purposes.
 */
const CLOSED_STATUS_TYPES = new Set(["DONE", "CANCELLED"]);

/**
 * Matches an Obsidian tag token at a word boundary: start of string or after
 * whitespace, a `#`, then tag-body characters (letters, digits, `_`, `-`, `/`
 * and any unicode letter/number). The leading-boundary requirement means a `#`
 * inside a word (e.g. `C#`, `foo#bar`) is never treated as a tag.
 */
const TAG_TOKEN = /(^|\s)(#[\w\-/\p{L}\p{N}]+)/gu;

/**
 * Remove inline `#tag` tokens from a task description when they duplicate the
 * tags the Tasks plugin already extracted into `task.tags` (which render as
 * separate tag chips). Only tokens whose body is a known extracted tag are
 * removed, so a stray `#token` the user wrote that isn't a real tag survives.
 *
 * Handles nested tags (`#a/b/c` is one token), tags anywhere in the text, and
 * never splits a `#` that sits mid-word. If stripping would empty the title,
 * the original description is returned so the card is never blank.
 */
export function stripTags(description: string, tags: string[]): string {
  if (!tags || tags.length === 0) {
    return description;
  }

  // task.tags may or may not carry a leading '#' depending on the source;
  // normalise to bare bodies for comparison.
  const known = new Set(tags.map((t) => (t.startsWith("#") ? t.slice(1) : t)));

  const stripped = description
    .replace(TAG_TOKEN, (match, lead: string, token: string) => {
      const body = token.slice(1);
      return known.has(body) ? lead : match;
    })
    .replace(/\s+/g, " ")
    .trim();

  return stripped.length > 0 ? stripped : description;
}

/**
 * Priority descriptor per obsidian-tasks' Priority enum (0 Highest … 5 Lowest).
 * Index 3 (None/Normal) is intentionally `null` so it renders no chip.
 */
export const PRIORITY_TABLE: Array<Omit<Chip, "title"> | null> = [
  { emoji: "🔺", label: "Highest", modifier: "priority-highest" },
  { emoji: "⏫", label: "High", modifier: "priority-high" },
  { emoji: "🔼", label: "Medium", modifier: "priority-medium" },
  null,
  { emoji: "🔽", label: "Low", modifier: "priority-low" },
  { emoji: "⏬", label: "Lowest", modifier: "priority-lowest" },
];

/**
 * Map a task's priority to a chip, tolerating either numeric or string input
 * (obsidian-tasks uses a string enum at runtime). None (3), null/undefined and
 * any out-of-range value produce no chip.
 */
export function getPriorityChip(
  priority: string | number | null | undefined,
): Chip | null {
  if (priority === null || priority === undefined || priority === "") {
    return null;
  }
  const n = Number(priority);
  if (!Number.isInteger(n) || n < 0 || n >= PRIORITY_TABLE.length) {
    return null;
  }
  return PRIORITY_TABLE[n];
}

/**
 * Normalise a date value to a `YYYY-MM-DD` string, defensively. Accepts plain
 * date strings, ISO datetime strings, `Date`, and Moment-like objects (which
 * obsidian-tasks may deliver at runtime). Returns null on anything it can't
 * interpret; never throws.
 */
export function formatDate(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  // Already a plain date string (optionally with a time component).
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : toLocalISODate(parsed);
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : toLocalISODate(value);
  }

  // Moment-like object.
  if (typeof value === "object") {
    const obj = value as {
      format?: (fmt: string) => string;
      toISOString?: () => string;
    };
    if (typeof obj.format === "function") {
      const out = obj.format("YYYY-MM-DD");
      return typeof out === "string" && out.length > 0 ? out : null;
    }
    if (typeof obj.toISOString === "function") {
      const iso = obj.toISOString();
      return typeof iso === "string" ? iso.slice(0, 10) : null;
    }
  }

  return null;
}

/**
 * Format a Date using its local calendar components, avoiding the timezone
 * off-by-one that `toISOString()` introduces for non-UTC zones.
 */
function toLocalISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * The date fields rendered on a card, in lifecycle display order so a card
 * reads created → start → scheduled → due → done → cancelled left to right.
 */
const DATE_SPECS: Array<{
  field: keyof Pick<
    Task,
    | "createdDate"
    | "startDate"
    | "scheduledDate"
    | "dueDate"
    | "doneDate"
    | "cancelledDate"
  >;
  emoji: string;
  modifier: string;
}> = [
  { field: "createdDate", emoji: "➕", modifier: "date-created" },
  { field: "startDate", emoji: "🛫", modifier: "date-start" },
  { field: "scheduledDate", emoji: "⏳", modifier: "date-scheduled" },
  { field: "dueDate", emoji: "📅", modifier: "date-due" },
  { field: "doneDate", emoji: "✅", modifier: "date-done" },
  { field: "cancelledDate", emoji: "❌", modifier: "date-cancelled" },
];

/**
 * Build a date chip for each present date field. A due date in the past on a
 * task that isn't done/cancelled is flagged as overdue.
 *
 * `now` is injectable for deterministic tests; it defaults to the current time.
 */
export function getDateChips(task: Task, now: Date = new Date()): Chip[] {
  const chips: Chip[] = [];
  const todayStart = startOfDay(now);

  for (const spec of DATE_SPECS) {
    const formatted = formatDate(task[spec.field]);
    if (!formatted) {
      continue;
    }

    const chip: Chip = {
      emoji: spec.emoji,
      label: formatted,
      modifier: spec.modifier,
    };

    if (
      spec.field === "dueDate" &&
      !CLOSED_STATUS_TYPES.has(task.status.type)
    ) {
      const due = new Date(`${formatted}T00:00:00`);
      if (
        !Number.isNaN(due.getTime()) &&
        due.getTime() < todayStart.getTime()
      ) {
        chip.modifier = "date-due-overdue";
        chip.title = "Overdue";
      }
    }

    chips.push(chip);
  }

  return chips;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Dependency chips derived for a single card.
 * - `blocked`: this task has at least one open (not done/cancelled) dependency.
 * - `dependsOn`: this task is blocked by N tasks (⛔).
 * - `id`: this task's own id (🆔). A task has at most one id, so it's shown
 *   directly; the tooltip lists any tasks that depend on it.
 */
export interface DependencyChips {
  blocked: Chip | null;
  dependsOn: Chip | null;
  id: Chip | null;
}

/**
 * Read a task's dependency id list, tolerating either field name.
 */
function readDependsOn(task: Task): string[] {
  return task.dependsOn ?? task.blockedBy ?? [];
}

/**
 * Compute dependency chips for a task against the full task list.
 *
 * Resolution is one level deep by design: cycles (a↔b) and self-references are
 * therefore harmless — no traversal, no recursion. Duplicate ids resolve to all
 * matching tasks; a dependency is "open" if any match is not done/cancelled.
 * Missing ids (no matching task) are listed but treated as non-blocking, since
 * an unknown task's state can't be verified.
 */
export function getDependencyChips(
  task: Task,
  allTasks: Task[],
): DependencyChips {
  const byId = new Map<string, Task[]>();
  for (const t of allTasks) {
    if (t.id) {
      const bucket = byId.get(t.id);
      if (bucket) {
        bucket.push(t);
      } else {
        byId.set(t.id, [t]);
      }
    }
  }

  const deps = readDependsOn(task);

  // dependsOn chip + blocked state
  let dependsOn: Chip | null = null;
  let blocked = false;
  if (deps.length > 0) {
    const titleParts: string[] = [];
    for (const depId of deps) {
      const matches = byId.get(depId) ?? [];
      if (matches.length === 0) {
        titleParts.push(`${depId} (missing)`);
        continue;
      }
      titleParts.push(matches.map((m) => m.description).join(" / "));

      // A task can't block itself; skip self-references for blocked state.
      if (depId === task.id) {
        continue;
      }
      if (matches.some((m) => !CLOSED_STATUS_TYPES.has(m.status.type))) {
        blocked = true;
      }
    }
    dependsOn = {
      emoji: "⛔",
      label: String(deps.length),
      modifier: "dep-blocked-by",
      title: titleParts.join(", "),
    };
  }

  const blockedChip: Chip | null = blocked
    ? { emoji: "🔒", label: "Blocked", modifier: "dep-blocked" }
    : null;

  // id chip: a task has at most one id, so display it directly. The tooltip
  // surfaces any other tasks that depend on it.
  let idChip: Chip | null = null;
  if (task.id) {
    const dependents = allTasks.filter(
      (t) => t !== task && readDependsOn(t).includes(task.id),
    );
    idChip = {
      emoji: "🆔",
      label: task.id,
      modifier: "dep-id",
      title:
        dependents.length > 0
          ? `Blocks: ${dependents.map((t) => t.description).join(", ")}`
          : undefined,
    };
  }

  return { blocked: blockedChip, dependsOn, id: idChip };
}
