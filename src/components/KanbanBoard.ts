import type { Task } from '../services/TasksIntegration';
import { TasksIntegration } from '../services/TasksIntegration';
import { KanbanColumn } from './KanbanColumn';
import { TaskFilter } from '../filters/TaskFilter';

/**
 * Configuration for a Kanban column
 */
export interface KanbanColumnConfig {
    id: string;
    title: string;
    statusSymbol: string;
    color?: string;
}

/**
 * Default columns: Todo, In Progress, Done
 */
const DEFAULT_COLUMNS: KanbanColumnConfig[] = [
    { id: 'todo', title: 'Todo', statusSymbol: ' ' },
    { id: 'in-progress', title: 'In Progress', statusSymbol: '/' },
    { id: 'done', title: 'Done', statusSymbol: 'x' },
];

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
     * Initialize columns from default configuration
     */
    private initColumns() {
        this.container.empty();
        this.container.addClass('tasks-kanban-board');

        for (const config of DEFAULT_COLUMNS) {
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
                (task) => task.status.symbol === column.config.statusSymbol,
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
