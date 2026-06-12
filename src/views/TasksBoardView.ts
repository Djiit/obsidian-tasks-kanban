import { ItemView, type WorkspaceLeaf } from 'obsidian';

import { TasksIntegration, type Task } from '../services/TasksIntegration';
import { KanbanBoard } from '../components/KanbanBoard';
import type { BoardStatePersistence } from '../types/persistence';

/**
 * The Kanban board view for displaying Tasks
 */
export class TasksBoardView extends ItemView {
    private tasksIntegration: TasksIntegration;
    private persistence: BoardStatePersistence;
    private kanbanBoard: KanbanBoard | null = null;
    private unsubscribe: (() => void) | null = null;

    constructor(
        leaf: WorkspaceLeaf,
        tasksIntegration: TasksIntegration,
        persistence: BoardStatePersistence,
    ) {
        super(leaf);
        this.tasksIntegration = tasksIntegration;
        this.persistence = persistence;
    }

    getViewType(): string {
        return 'tasks-board';
    }

    getDisplayText(): string {
        return 'Tasks kanban board';
    }

    getIcon(): string {
        return 'columns';
    }

    async onOpen() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass('tasks-kanban-view');

        // Load the vault's status configuration so columns reflect it
        // (also picks up status-config changes whenever the board is reopened).
        await this.tasksIntegration.loadStatuses();

        // Create the Kanban board
        this.kanbanBoard = new KanbanBoard(
            containerEl,
            this.tasksIntegration,
            this.persistence,
        );

        // Subscribe to tasks updates
        this.unsubscribe = this.tasksIntegration.subscribe((tasks: Task[]) => {
            this.kanbanBoard?.updateTasks(tasks);
        });

        // Initial render
        this.kanbanBoard.render();
    }

    async onClose() {
        const { containerEl } = this;
        containerEl.empty();

        // Clean up subscription
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }

        // Clean up Kanban board
        if (this.kanbanBoard) {
            this.kanbanBoard.destroy();
            this.kanbanBoard = null;
        }
    }

    /**
     * Refresh the view with current tasks
     */
    refresh() {
        if (this.kanbanBoard) {
            const tasks = this.tasksIntegration.getTasks();
            this.kanbanBoard.updateTasks(tasks);
        }
    }
}
