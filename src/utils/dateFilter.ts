import type { Task } from "../services/TasksIntegration";

/**
 * Date fields that can be filtered on, matching the Tasks plugin's date fields.
 */
export type DateField =
  | "dueDate"
  | "scheduledDate"
  | "startDate"
  | "createdDate"
  | "doneDate"
  | "cancelledDate";

/**
 * Maps Tasks plugin date keywords to internal date fields.
 * Tasks uses: due, scheduled, start, created, done, cancelled
 * Also supports plural forms: dues, scheduleds, starts, createds, dones, cancelleds
 */
export const DATE_KEYWORD_TO_FIELD: Record<string, DateField> = {
  due: "dueDate",
  dues: "dueDate",
  scheduled: "scheduledDate",
  scheduleds: "scheduledDate",
  start: "startDate",
  starts: "startDate",
  created: "createdDate",
  createds: "createdDate",
  done: "doneDate",
  dones: "doneDate",
  cancelled: "cancelledDate",
  cancelleds: "cancelledDate",
};

/**
 * Inverse mapping for serialization.
 */
export const DATE_FIELD_TO_KEYWORD: Record<DateField, string> = {
  dueDate: "due",
  scheduledDate: "scheduled",
  startDate: "start",
  createdDate: "created",
  doneDate: "done",
  cancelledDate: "cancelled",
};

/**
 * Supported date operators.
 */
export type DateOperator = "before" | "after" | "on" | "in" | "has" | "no";

/**
 * A parsed date filter instruction.
 */
export interface DateFilterInstruction {
  kind: "date";
  field: DateField;
  operator: DateOperator;
  value: string; // The raw value (date string, "today", "tomorrow", "this week", etc.)
  keyword?: string; // The original keyword used (e.g., "starts" vs "start")
}

/**
 * Relative date values that imply an "on" operator when used alone.
 */
const RELATIVE_DATES = new Set(["today", "tomorrow", "yesterday"]);

/**
 * Relative period values that imply an "in" operator when used alone.
 */
const RELATIVE_PERIODS = new Set([
  "this week",
  "next week",
  "last week",
  "this month",
  "next month",
  "last month",
  "this year",
]);

/**
 * Parse a date filter line like "starts before tomorrow" or "due after 2026-07-10"
 * Returns the parsed instruction or null if the line doesn't match.
 */
export function parseDateFilter(line: string): DateFilterInstruction | null {
  // Pattern: <date-field> <operator> <value>
  // Examples: "starts before tomorrow", "due after 2026-07-10", "has start date", "no due date"
  // Also supports: "starts today" (implicit "on" operator), "starts this week" (implicit "in")

  const dateFilterRegex = /^(\S+)\s+(\S+)(?:\s+(.+))?$/i;
  const match = dateFilterRegex.exec(line);

  if (!match) {
    return null;
  }

  let fieldKeyword = match[1].toLowerCase();
  const originalFieldKeyword = match[1]; // Preserve original case
  let operator = match[2].toLowerCase();
  let value = match[3] ? match[3].trim() : "";

  // Handle special "has" and "no" operators
  // e.g., "has start date" or "no due date"
  // In these cases: fieldKeyword="has", operator="start", value="date"
  // We need to swap: field="start", operator="has", value="date"
  if (fieldKeyword === "has" || fieldKeyword === "no") {
    // operator is actually the field keyword
    const fieldFromOperator = DATE_KEYWORD_TO_FIELD[operator];
    if (fieldFromOperator) {
      return {
        kind: "date",
        field: fieldFromOperator,
        operator: fieldKeyword as DateOperator,
        value: value || "date", // "has start date" -> value="date", "has start" -> value=""
        keyword: operator, // Store the original field keyword
      };
    }
    return null;
  }

  // Check if this is a valid date field
  const field = DATE_KEYWORD_TO_FIELD[fieldKeyword];
  if (!field) {
    return null;
  }

  // Handle implicit operators for relative dates/periods
  // e.g., "starts today" -> "starts on today"
  // e.g., "starts this week" -> "starts in this week"

  // Check if operator + value forms a relative period
  const combinedValue = `${operator} ${value}`.trim();
  if (value !== "" && RELATIVE_PERIODS.has(combinedValue)) {
    // "starts this week" -> operator="this", value="week" -> combined="this week"
    value = combinedValue;
    operator = "in";
  } else if (value === "" && RELATIVE_DATES.has(operator)) {
    // "starts today" -> value="", operator="today" -> implicit "on"
    value = operator;
    operator = "on";
  } else if (value === "" && RELATIVE_PERIODS.has(operator)) {
    // "starts this week" parsed as operator="this week" - but this won't happen
    // because "this week" has a space, so it would be split
    value = operator;
    operator = "in";
  }

  // Check if this is a valid operator
  const validOperators: DateOperator[] = [
    "before",
    "after",
    "on",
    "in",
    "has",
    "no",
  ];
  if (!validOperators.includes(operator as DateOperator)) {
    return null;
  }

  return {
    kind: "date",
    field,
    operator: operator as DateOperator,
    value,
    keyword: originalFieldKeyword, // Store the original keyword for serialization
  };
}

/**
 * Check if a task matches a date filter instruction.
 */
export function matchesDateFilter(
  task: Task,
  filter: DateFilterInstruction,
  referenceDate: Date = new Date(),
): boolean {
  const taskDateValue = task[filter.field];

  // Handle "has" and "no" operators
  if (filter.operator === "has") {
    // "has start date" means the task has a value for that date field
    return (
      taskDateValue !== null &&
      taskDateValue !== undefined &&
      taskDateValue !== ""
    );
  }

  if (filter.operator === "no") {
    // "no start date" means the task does NOT have a value for that date field
    return (
      taskDateValue === null ||
      taskDateValue === undefined ||
      taskDateValue === ""
    );
  }

  // For other operators, we need a valid date value
  if (!taskDateValue) {
    return false;
  }

  // Normalize the task's date to YYYY-MM-DD
  const taskDate = normalizeDateString(taskDateValue);
  if (!taskDate) {
    return false;
  }

  // Parse the filter value based on the operator
  switch (filter.operator) {
    case "before":
      return compareDates(taskDate, filter.value, referenceDate) < 0;
    case "after":
      return compareDates(taskDate, filter.value, referenceDate) > 0;
    case "on":
      return compareDates(taskDate, filter.value, referenceDate) === 0;
    case "in":
      return isDateInPeriod(taskDate, filter.value, referenceDate);
    default:
      return false;
  }
}

/**
 * Normalize a date string to YYYY-MM-DD format.
 * Handles various formats including ISO strings with time components.
 */
function normalizeDateString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  // Handle Date objects by converting to ISO string first
  if (value instanceof Date) {
    // Convert Date to ISO string, then extract just the date part
    const iso = value.toISOString();
    return iso.slice(0, 10);
  }

  if (typeof value !== "string") {
    // For Moment-like objects, try toISOString first
    if (
      typeof value === "object" &&
      value &&
      typeof (value as { toISOString?: () => string }).toISOString ===
        "function"
    ) {
      return (value as { toISOString: () => string })
        .toISOString()
        .slice(0, 10);
    }
    return null;
  }

  const trimmed = value.trim();

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Try to parse as a date
  try {
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return toLocalISODate(date);
  } catch {
    return null;
  }
}

/**
 * Format a Date using its local calendar components.
 */
function toLocalISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Compare two date values (one from task, one from filter) with a reference date.
 * Returns -1 if taskDate < filterDate, 0 if equal, 1 if taskDate > filterDate.
 */
function compareDates(
  taskDate: string,
  filterValue: string,
  referenceDate: Date,
): number {
  const filterDate = parseFilterDateValue(filterValue, referenceDate);
  if (!filterDate) {
    return 0; // If we can't parse the filter value, don't match
  }

  if (taskDate < filterDate) {
    return -1;
  } else if (taskDate > filterDate) {
    return 1;
  }
  return 0;
}

/**
 * Parse a filter date value, which could be a specific date or a relative date.
 * Returns the date in YYYY-MM-DD format.
 */
function parseFilterDateValue(
  value: string,
  referenceDate: Date,
): string | null {
  const trimmed = value.trim().toLowerCase();

  // Handle relative dates
  switch (trimmed) {
    case "today":
      return toLocalISODate(referenceDate);
    case "tomorrow": {
      const tomorrow = new Date(referenceDate);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return toLocalISODate(tomorrow);
    }
    case "yesterday": {
      const yesterday = new Date(referenceDate);
      yesterday.setDate(yesterday.getDate() - 1);
      return toLocalISODate(yesterday);
    }
    default:
      // Try to parse as a specific date
      return normalizeDateString(value);
  }
}

/**
 * Check if a date falls within a period like "this week", "next week", etc.
 */
function isDateInPeriod(
  taskDate: string,
  period: string,
  referenceDate: Date,
): boolean {
  const trimmed = period.trim().toLowerCase();

  switch (trimmed) {
    case "this week":
      return isDateInCurrentWeek(taskDate, referenceDate);
    case "next week":
      return isDateInNextWeek(taskDate, referenceDate);
    case "last week":
      return isDateInLastWeek(taskDate, referenceDate);
    case "this month":
      return isDateInCurrentMonth(taskDate, referenceDate);
    case "next month":
      return isDateInNextMonth(taskDate, referenceDate);
    case "last month":
      return isDateInLastMonth(taskDate, referenceDate);
    case "this year":
      return isDateInCurrentYear(taskDate, referenceDate);
    default:
      return false;
  }
}

/**
 * Check if a date (YYYY-MM-DD) is in the current week.
 * Week starts on Sunday (ISO week starts on Monday, but Tasks uses Sunday-based weeks).
 */
function isDateInCurrentWeek(taskDate: string, referenceDate: Date): boolean {
  const date = new Date(taskDate + "T00:00:00");
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);

  // Get the start of the week (Sunday)
  const refWeekStart = new Date(ref);
  refWeekStart.setDate(ref.getDate() - ref.getDay());

  // Get the end of the week (Saturday)
  const refWeekEnd = new Date(ref);
  refWeekEnd.setDate(ref.getDate() + (6 - ref.getDay()));

  return date >= refWeekStart && date <= refWeekEnd;
}

/**
 * Check if a date is in the next week.
 */
function isDateInNextWeek(taskDate: string, referenceDate: Date): boolean {
  const date = new Date(taskDate + "T00:00:00");
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);

  // Get the start of next week (Sunday)
  const nextWeekStart = new Date(ref);
  nextWeekStart.setDate(ref.getDate() - ref.getDay() + 7);

  // Get the end of next week (Saturday)
  const nextWeekEnd = new Date(ref);
  nextWeekEnd.setDate(ref.getDate() + (6 - ref.getDay()) + 7);

  return date >= nextWeekStart && date <= nextWeekEnd;
}

/**
 * Check if a date is in the last week.
 */
function isDateInLastWeek(taskDate: string, referenceDate: Date): boolean {
  const date = new Date(taskDate + "T00:00:00");
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);

  // Get the start of last week (Sunday)
  const lastWeekStart = new Date(ref);
  lastWeekStart.setDate(ref.getDate() - ref.getDay() - 7);

  // Get the end of last week (Saturday)
  const lastWeekEnd = new Date(ref);
  lastWeekEnd.setDate(ref.getDate() + (6 - ref.getDay()) - 7);

  return date >= lastWeekStart && date <= lastWeekEnd;
}

/**
 * Check if a date is in the current month.
 */
function isDateInCurrentMonth(taskDate: string, referenceDate: Date): boolean {
  const date = new Date(taskDate + "T00:00:00");
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);

  return (
    date.getFullYear() === ref.getFullYear() &&
    date.getMonth() === ref.getMonth()
  );
}

/**
 * Check if a date is in the next month.
 */
function isDateInNextMonth(taskDate: string, referenceDate: Date): boolean {
  const date = new Date(taskDate + "T00:00:00");
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);

  const nextMonth = new Date(ref);
  nextMonth.setMonth(ref.getMonth() + 1);

  return (
    date.getFullYear() === nextMonth.getFullYear() &&
    date.getMonth() === nextMonth.getMonth()
  );
}

/**
 * Check if a date is in the last month.
 */
function isDateInLastMonth(taskDate: string, referenceDate: Date): boolean {
  const date = new Date(taskDate + "T00:00:00");
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);

  const lastMonth = new Date(ref);
  lastMonth.setMonth(ref.getMonth() - 1);

  return (
    date.getFullYear() === lastMonth.getFullYear() &&
    date.getMonth() === lastMonth.getMonth()
  );
}

/**
 * Check if a date is in the current year.
 */
function isDateInCurrentYear(taskDate: string, referenceDate: Date): boolean {
  const date = new Date(taskDate + "T00:00:00");
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);

  return date.getFullYear() === ref.getFullYear();
}

/**
 * Serialize a date filter instruction back to a query line.
 */
export function serializeDateFilter(filter: DateFilterInstruction): string {
  // Use the stored keyword if available, otherwise fall back to the default
  const keyword = filter.keyword || DATE_FIELD_TO_KEYWORD[filter.field];
  return `${keyword} ${filter.operator} ${filter.value}`;
}
