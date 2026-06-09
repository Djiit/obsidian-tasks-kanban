import { type App, type TFile } from 'obsidian';
import type { Task } from './TasksIntegration';

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
    async updateTaskStatus(task: Task, newStatusSymbol: string): Promise<boolean> {
        const filePath = task.taskLocation?.path;
        if (!filePath) {
            return false;
        }

        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (!file || !(file instanceof TFile)) {
            return false;
        }

        try {
            // Read the file content
            const content = await this.app.vault.read(file);
            
            // Find and replace the task line
            const updatedContent = this.replaceTaskStatus(
                content,
                task.originalMarkdown,
                task.status.symbol,
                newStatusSymbol,
            );

            if (updatedContent !== content) {
                // Write the updated content
                await this.app.vault.write(file, updatedContent);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to update task status:', error);
            return false;
        }
    }

    /**
     * Replace the status symbol in a task line
     * Handles both `- [x]` and `- [ ]` formats
     */
    private replaceTaskStatus(
        content: string,
        originalLine: string,
        oldStatus: string,
        newStatus: string,
    ): string {
        // Escape special regex characters in the original line
        // Create regex to match the task line with the old status
        // Format: - [oldStatus] description
        const lineRegex = new RegExp(
            `^(\\s*)- \\[${oldStatus}\\]\\s*(.*)$`,
            'gm',
        );

        // Replace with new status
        const updatedContent = content.replace(
            lineRegex,
            `$1- [${newStatus}]$2`,
        );

        return updatedContent;
    }

    /**
     * Alternative method: find task by ID and update its status
     * More reliable if the original markdown has changed
     */
    async updateTaskStatusById(
        filePath: string,
        taskId: string,
        newStatusSymbol: string,
    ): Promise<boolean> {
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (!file || !(file instanceof TFile)) {
            return false;
        }

        try {
            const content = await this.app.vault.read(file);
            
            // Find the line containing the task ID
            // Tasks plugin format: - [x] description ^task-id
            const taskIdPattern = new RegExp(`(\\s*- \\[[^\\]]+\\]\\s*.*?)\\s*\\^${taskId}\\b`);
            
            if (!taskIdPattern.test(content)) {
                return false;
            }

            const updatedContent = content.replace(
                taskIdPattern,
                (match, taskLine) => {
                    // Extract the current status from the task line
                    const statusMatch = taskLine.match(/\*\[([^\\]]+)\]/);
                    if (!statusMatch) return match;
                    
                    const currentStatus = statusMatch[1];
                    const updatedLine = taskLine.replace(
                        `[${currentStatus}]`,
                        `[${newStatusSymbol}]`,
                    );
                    return updatedLine;
                },
            );

            if (updatedContent !== content) {
                await this.app.vault.write(file, updatedContent);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to update task status by ID:', error);
            return false;
        }
    }
}
