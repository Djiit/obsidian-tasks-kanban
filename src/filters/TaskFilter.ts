import type { Task } from "../services/TasksIntegration";

/**
 * Task filter service for filtering tasks using Tasks query syntax
 */
export class TaskFilter {
  /**
   * Filter tasks based on a query string
   * Supports basic Tasks query syntax:
   * - #tag - filter by tag
   * - path:"folder" - filter by path
   * - status:"x" - filter by status symbol
   * - due:2024-01-01 - filter by due date
   * - due before 2024-01-01
   * - due after 2024-01-01
   */
  filterTasks(tasks: Task[], query: string): Task[] {
    if (!query || query.trim() === "") {
      return [...tasks];
    }

    // Parse the query into individual filters
    const filters = this.parseQuery(query);

    // Apply each filter sequentially
    let result = [...tasks];
    for (const filter of filters) {
      result = result.filter((task) => this.applyFilter(task, filter));
    }

    return result;
  }

  /**
   * Parse a query string into filter objects
   */
  private parseQuery(query: string): Filter[] {
    const filters: Filter[] = [];

    // Split by spaces, but respect quoted strings
    const tokens = this.tokenizeQuery(query);

    for (const token of tokens) {
      const filter = this.parseToken(token);
      if (filter) {
        filters.push(filter);
      }
    }

    return filters;
  }

  /**
   * Tokenize query string respecting quotes
   */
  private tokenizeQuery(query: string): string[] {
    const tokens: string[] = [];
    let current = "";
    let inQuotes = false;
    let quoteChar = "";

    for (const char of query) {
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = "";
        current += char;
      } else if (char === " " && !inQuotes) {
        if (current) {
          tokens.push(current);
          current = "";
        }
      } else {
        current += char;
      }
    }

    if (current) {
      tokens.push(current);
    }

    return tokens;
  }

  /**
   * Parse a token into a filter object
   */
  private parseToken(token: string): Filter | null {
    // Handle tags: #tag
    if (token.startsWith("#")) {
      return { type: "tag", value: token.substring(1) };
    }

    // Handle path:path/to/file
    if (token.startsWith("path:")) {
      const value = token.substring(5).trim();
      // Remove surrounding quotes if present
      const cleanValue = value.replace(/^["'\s]+|["'"]+$/g, "");
      return { type: "path", value: cleanValue };
    }

    // Handle status:symbol
    if (token.startsWith("status:")) {
      const value = token
        .substring(7)
        .trim()
        .replace(/^["'\s]+|["'"]+$/g, "");
      return { type: "status", value };
    }

    // Handle due:date
    if (token.startsWith("due:")) {
      const value = token
        .substring(4)
        .trim()
        .replace(/^["'\s]+|["'"]+$/g, "");
      return { type: "due", operator: "equals", value };
    }

    // Handle due before date
    if (token.startsWith("due before")) {
      const value = token
        .substring(10)
        .trim()
        .replace(/^["'\s]+|["'"]+$/g, "");
      return { type: "due", operator: "before", value };
    }

    // Handle due after date
    if (token.startsWith("due after")) {
      const value = token
        .substring(9)
        .trim()
        .replace(/^["'\s]+|["'"]+$/g, "");
      return { type: "due", operator: "after", value };
    }

    // Handle priority:1-3
    if (token.startsWith("priority:")) {
      const value = token.substring(9).trim();
      const priority = parseInt(value);
      if (!isNaN(priority)) {
        return { type: "priority", value: priority };
      }
    }

    // Handle raw text (search in description)
    if (token && !token.startsWith("-")) {
      return { type: "description", value: token };
    }

    return null;
  }

  /**
   * Apply a single filter to a task
   */
  private applyFilter(task: Task, filter: Filter): boolean {
    switch (filter.type) {
      case "tag":
        return task.tags?.some((tag) => tag === filter.value);

      case "path":
        return task.taskLocation?.path.includes(String(filter.value));

      case "status":
        return task.status.symbol === filter.value;

      case "due":
        return this.filterByDueDate(task, filter);

      case "priority":
        return task.priority === filter.value;

      case "description":
        return task.description
          .toLowerCase()
          .includes(String(filter.value).toLowerCase());

      default:
        return true;
    }
  }

  /**
   * Filter by due date
   */
  private filterByDueDate(task: Task, filter: Filter): boolean {
    if (!task.dueDate) return false;

    const taskDate = new Date(task.dueDate);
    const filterDate = new Date(String(filter.value));

    switch (filter.operator) {
      case "before":
        return taskDate < filterDate;
      case "after":
        return taskDate > filterDate;
      case "equals":
        return taskDate.toDateString() === filterDate.toDateString();
      default:
        return true;
    }
  }
}

/**
 * Filter type definition
 */
interface Filter {
  type: "tag" | "path" | "status" | "due" | "priority" | "description";
  value: string | string[] | number | boolean | null;
  operator?: "equals" | "before" | "after";
}
