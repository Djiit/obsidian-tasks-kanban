import type { Task } from '../services/TasksIntegration';
import { TasksIntegration } from '../services/TasksIntegration';
import { KanbanColumn } from './KanbanColumn';
import { TaskFilter } from '../filters/TaskFilter';
import { buildColumns } from '../utils/statusColumns';

export type { KanbanColumnConfig } from '../utils/statusColumns';

/**
 * The Kanban board component
 */
export class KanbanBoard {
    private container: HTMLElement;
    private tasksIntegration: TasksIntegration;
    private columns: KanbanColumn[] = [];
    private tasks: Task[] = [];
    private filter: TaskFilter;

    constructor(container: HTMLElement, tasksIntegration: TasksIntegration) {
        this.container = container;
        this.tasksIntegration = tasksIntegration;
        this.filter = new TaskFilter();

        // Initialize default columns
        this.initColumns();
    }

    /**
     * Initialize columns derived from the vault's configured statuses
     */
    private initColumns() {
        this.container.empty();
        this.container.addClass('tasks-kanban-board');

        const columnConfigs = buildColumns(this.tasksIntegration.getStatuses());
        for (const config of columnConfigs) {
            const columnEl = this.container.createDiv({
                cls: 'tasks-kanban-column',
            });
            const column = new KanbanColumn(columnEl, config, this.tasksIntegration);
            this.columns.push(column);
        }
    }

    /**
     * Render the board with current tasks
     */
    render() {
        this.updateTasks(this.tasks);
    }

    /**
     * Update tasks and redistribute across columns
     */
    updateTasks(tasks: Task[]) {
        // Remove duplicates by ID
        const uniqueTasks = this.removeDuplicateTasks(tasks);
        this.tasks = uniqueTasks;
        this.distributeTasks();
    }

    /**
     * Remove duplicate tasks based on ID
     */
    private removeDuplicateTasks(tasks: Task[]): Task[] {
        const seenIds = new Set<string>();
        return tasks.filter((task) => {
            const id = task.id || task.originalMarkdown;
            if (seenIds.has(id)) {
                return false;
            }
            seenIds.add(id);
            return true;
        });
    }

    /**
     * Distribute tasks across columns based on their status
     */
    private distributeTasks() {
        for (const column of this.columns) {
            const statusTasks = this.tasks.filter(
                (task) => task.status.type === column.config.type,
            );
            column.updateTasks(statusTasks);
        }
    }

    /**
     * Apply a filter to all tasks
     */
    applyFilter(filterString: string) {
        const filteredTasks = this.filter.filterTasks(this.tasks, filterString);
        this.updateTasks(filteredTasks);
    }

    /**
     * Clean up the board
     */
    destroy() {
        for (const column of this.columns) {
            column.destroy();
        }
        this.columns = [];
    }
}
