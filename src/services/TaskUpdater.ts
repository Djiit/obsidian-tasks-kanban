import { type App, TFile } from "obsidian";
import type { Task } from "./TasksIntegration";

/**
 * Service for updating task status in source files
 */
export class TaskUpdater {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Update the status of a task in its source file
   * Replaces the status symbol in the task line
   */
  async updateTaskStatus(
    task: Task,
    newStatusSymbol: string,
  ): Promise<boolean> {
    const filePath = task.taskLocation?.path;
    const lineNumber = task.taskLocation?.lineNumber;
    if (!filePath || lineNumber === undefined) {
      return false;
    }

    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!file || !(file instanceof TFile)) {
      return false;
    }

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

      lines[lineNumber] = `${match[1]}${newStatusSymbol}${match[2]}`;
      await this.app.vault.modify(file, lines.join("\n"));
      return true;
    } catch (error) {
      console.error("Failed to update task status:", error);
      return false;
    }
  }
}
