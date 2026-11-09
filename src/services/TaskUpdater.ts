import { type App, Notice, TFile } from "obsidian";
import type { StatusInfo, Task } from "./TasksIntegration";
import type { TasksIntegration } from "./TasksIntegration";
import { FIELD_SYNTAX, resolveTaskFormat } from "../utils/taskFormat";

/**
 * Service for updating tasks in source files
 */
export class TaskUpdater {
  private app: App;
  private tasksIntegration: TasksIntegration;

  constructor(app: App, tasksIntegration: TasksIntegration) {
    this.app = app;
    this.tasksIntegration = tasksIntegration;
  }

  /**
   * Update the status of a task in its source file
   * Replaces the status symbol in the task line
   * Also adds done/cancelled date if transitioning to DONE/CANCELLED and settings are enabled
   */
  async updateTaskStatus(
    task: Task,
    newStatusSymbol: string,
  ): Promise<boolean> {
    const file = this.findTaskFile(task);
    if (!file) {
      return false;
    }
    const lineNumber = task.taskLocation.lineNumber;

    try {
      const content = await this.app.vault.read(file);
      const lines = content.split("\n");

      if (lineNumber < 0 || lineNumber >= lines.length) {
        return false;
      }

      const line = lines[lineNumber];
      const match = line.match(/^(\s*- \[)[^\]]*(]\s*.*)$/);
      if (!match) {
        return false;
      }

      // Get Tasks plugin write settings
      const { setDoneDate, setCancelledDate, taskFormat } =
        await this.tasksIntegration.getWriteSettings();
      const syntax = FIELD_SYNTAX[resolveTaskFormat(taskFormat)];

      // Get current and new status types
      const currentStatus = this.tasksIntegration.getStatusBySymbol(
        task.status.symbol,
      );
      const newStatus =
        this.tasksIntegration.getStatusBySymbol(newStatusSymbol);

      // Completing a recurring task must also create its next occurrence, and
      // only the Tasks plugin can compute it. Delegate the whole line rewrite
      // to its toggle command; fall through to the plain rewrite when it can't.
      if (
        newStatus?.type === "DONE" &&
        currentStatus?.type !== "DONE" &&
        task.recurrence
      ) {
        const replacement = this.toggleRecurringCompletion(
          line,
          match,
          task,
          currentStatus,
          newStatusSymbol,
        );
        if (replacement) {
          lines.splice(lineNumber, 1, ...replacement);
          await this.app.vault.modify(file, lines.join("\n"));
          return true;
        }
      }

      // First, replace the status symbol in the line
      const lineWithNewSymbol = line.replace(
        `${match[1]}${task.status.symbol}${match[2]}`,
        `${match[1]}${newStatusSymbol}${match[2]}`,
      );

      // Build the updated line
      let updatedLine = lineWithNewSymbol;

      // Handle done date: add when transitioning TO DONE, remove when transitioning AWAY from DONE
      if (newStatus?.type === "DONE" && currentStatus?.type !== "DONE") {
        if (setDoneDate) {
          const today = this.getTodayDateString();
          // No $ anchor: see FieldSyntax.strip doc comment in taskFormat.ts.
          updatedLine = updatedLine.replace(syntax.doneDate.strip, "");
          updatedLine = `${updatedLine}${syntax.doneDate.render(today)}`;
        }
      } else if (currentStatus?.type === "DONE" && newStatus?.type !== "DONE") {
        // Transitioning AWAY from DONE - remove the done date
        updatedLine = updatedLine.replace(syntax.doneDate.strip, "");
      }

      // Handle cancelled date: add when transitioning TO CANCELLED, remove when transitioning AWAY from CANCELLED
      if (
        newStatus?.type === "CANCELLED" &&
        currentStatus?.type !== "CANCELLED"
      ) {
        if (setCancelledDate) {
          const today = this.getTodayDateString();
          updatedLine = updatedLine.replace(syntax.cancelledDate.strip, "");
          updatedLine = `${updatedLine}${syntax.cancelledDate.render(today)}`;
        }
      } else if (
        currentStatus?.type === "CANCELLED" &&
        newStatus?.type !== "CANCELLED"
      ) {
        // Transitioning AWAY from CANCELLED - remove the cancelled date
        updatedLine = updatedLine.replace(syntax.cancelledDate.strip, "");
      }

      lines[lineNumber] = updatedLine;

      await this.app.vault.modify(file, lines.join("\n"));
      return true;
    } catch (error) {
      console.error("Failed to update task status:", error);
      return false;
    }
  }

  /**
   * Ask the Tasks plugin to complete a recurring task: its toggle command
   * returns the completed line plus the next occurrence (two lines) when the
   * task recurs. Returns the replacement lines, or null when the installed
   * Tasks offers no toggle API or no status leads to the target symbol, in
   * which case the caller falls back to the plain symbol rewrite.
   */
  private toggleRecurringCompletion(
    line: string,
    match: RegExpMatchArray,
    task: Task,
    currentStatus: StatusInfo | undefined,
    newStatusSymbol: string,
  ): string[] | null {
    const toggle = this.tasksIntegration.getToggleTaskDoneCommand();
    if (!toggle) {
      return null;
    }

    // The toggle advances a line to the next status of its current symbol, but
    // a kanban drop targets the column's symbol directly. Feed it a line whose
    // symbol leads to the target: the task's own when the chain already points
    // there, otherwise any configured predecessor of the target.
    const predecessor =
      currentStatus?.nextStatusSymbol === newStatusSymbol
        ? task.status.symbol
        : this.tasksIntegration
            .getStatuses()
            .find(
              (s) =>
                s.nextStatusSymbol === newStatusSymbol &&
                (s.type === "TODO" || s.type === "IN_PROGRESS"),
            )?.symbol;
    if (!predecessor) {
      return null;
    }

    const lineToToggle =
      predecessor === task.status.symbol
        ? line
        : line.replace(
            `${match[1]}${task.status.symbol}${match[2]}`,
            `${match[1]}${predecessor}${match[2]}`,
          );

    let output: string;
    try {
      output = toggle(lineToToggle, task.taskLocation.path);
    } catch (error) {
      console.error("Tasks toggle failed, falling back:", error);
      return null;
    }
    const resultLines = output.split("\n");
    // Only the checkbox counts: the target symbol can also appear in the text.
    const completed = resultLines.some(
      (l) => l.match(/^\s*- \[([^\]]*)]/)?.[1] === newStatusSymbol,
    );
    return completed ? resultLines : null;
  }

  /**
   * Edit a task in the Tasks plugin's "Create or edit task" modal and write
   * the result back in place of the task's line. Returns false when Tasks
   * offers no such modal, the task's file can't be found, the modal is
   * cancelled, or the line changed while the modal was open.
   */
  async editTask(task: Task): Promise<boolean> {
    const editTaskLine = this.tasksIntegration.getEditTaskLineModal();
    const file = this.findTaskFile(task);
    if (!editTaskLine || !file) {
      return false;
    }
    const lineNumber = task.taskLocation.lineNumber;

    try {
      const editedLines = await editTaskLine(task.originalMarkdown);
      if (editedLines === "") {
        return false;
      }

      const lines = (await this.app.vault.read(file)).split("\n");
      // The modal edited the line as the Tasks cache last saw it. If the file
      // has changed since, writing would overwrite whatever is there now.
      if (lines[lineNumber] !== task.originalMarkdown) {
        new Notice("The task changed in its file, so the edit was not saved.");
        return false;
      }

      lines[lineNumber] = editedLines;
      await this.app.vault.modify(file, lines.join("\n"));
      return true;
    } catch (error) {
      console.error("Failed to edit task:", error);
      return false;
    }
  }

  /**
   * The file holding the task, or null when the task has no location or its
   * path doesn't resolve to a file.
   */
  private findTaskFile(task: Task): TFile | null {
    const filePath = task.taskLocation?.path;
    if (!filePath || task.taskLocation?.lineNumber === undefined) {
      return null;
    }
    const file = this.app.vault.getAbstractFileByPath(filePath);
    return file instanceof TFile ? file : null;
  }

  /**
   * Get today's date as a formatted string (YYYY-MM-DD)
   * Uses window.moment if available, otherwise falls back to standard Date
   */
  private getTodayDateString(): string {
    if (typeof window !== "undefined" && window.moment) {
      return window.moment().format("YYYY-MM-DD");
    }
    // Fallback for testing or environments without moment
    const today = new Date();
    return today.toISOString().split("T")[0];
  }
}
