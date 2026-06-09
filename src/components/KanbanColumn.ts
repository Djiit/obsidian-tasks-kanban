import type { Task } from '../services/TasksIntegration';
import { TasksIntegration } from '../services/TasksIntegration';
import { KanbanCard } from './KanbanCard';
import type { KanbanColumnConfig } from './KanbanBoard';

/**
 * The Kanban column component
 */
export class KanbanColumn {
    private container: HTMLElement;
    private config: KanbanColumnConfig;
    private tasksIntegration: TasksIntegration;
    private cards: KanbanCard[] = [];
    private dragOverHandler: ((e: DragEvent) => void) | null = null;
    private dragLeaveHandler: ((e: DragEvent) => void) | null = null;
    private dropHandler: ((e: DragEvent) => void) | null = null;
    private dragEnterHandler: ((e: DragEvent) => void) | null = null;

    constructor(
        container: HTMLElement,
        config: KanbanColumnConfig,
        tasksIntegration: TasksIntegration,
    ) {
        this.container = container;
        this.config = config;
        this.tasksIntegration = tasksIntegration;

        this.init();
        this.setupDragAndDrop();
    }

    /**
     * Initialize the column
     */
    private init() {
        this.container.empty();
        this.container.addClass('tasks-kanban-column');
        this.container.setAttribute('data-status-symbol', this.config.statusSymbol);

        // Create header
        const header = this.container.createDiv({
            cls: 'tasks-kanban-column-header',
        });
        header.createSpan({
            cls: 'tasks-kanban-column-title',
            text: this.config.title,
        });

        // Create count badge
        const countBadge = header.createSpan({
            cls: 'tasks-kanban-column-count',
        });
        countBadge.setText('0');

        // Create cards container
        this.container.createDiv({
            cls: 'tasks-kanban-column-cards',
        });

        // Store references
        this.container.setAttribute('data-column-id', this.config.id);
    }

    /**
     * Update tasks in this column
     */
    updateTasks(tasks: Task[]) {
        // Clear existing cards
        for (const card of this.cards) {
            card.destroy();
        }
        this.cards = [];

        // Update count
        const countBadge = this.container.querySelector('.tasks-kanban-column-count');
        if (countBadge) {
            countBadge.setText(String(tasks.length));
        }

        // Create new cards
        const cardsContainer = this.container.querySelector('.tasks-kanban-column-cards');
        if (!cardsContainer) return;

        for (const task of tasks) {
            const cardEl = cardsContainer.createDiv({
                cls: 'tasks-kanban-card',
            });
            const card = new KanbanCard(cardEl, task, this.tasksIntegration);
            this.cards.push(card);
            card.render();
        }
    }

    /**
     * Set up drag and drop for the column
     */
    private setupDragAndDrop() {
        const cardsContainer = this.container.querySelector('.tasks-kanban-column-cards');
        if (!cardsContainer) return;

        // Drag over - add visual feedback
        this.dragOverHandler = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer!.dropEffect = 'move';
            this.container.addClass('tasks-kanban-column-drag-over');
        };
        cardsContainer.addEventListener('dragover', this.dragOverHandler);

        // Drag enter
        this.dragEnterHandler = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            this.container.addClass('tasks-kanban-column-drag-over');
        };
        cardsContainer.addEventListener('dragenter', this.dragEnterHandler);

        // Drag leave
        this.dragLeaveHandler = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            this.container.removeClass('tasks-kanban-column-drag-over');
        };
        cardsContainer.addEventListener('dragleave', this.dragLeaveHandler);

        // Drop - handle the task status change
        this.dropHandler = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            this.container.removeClass('tasks-kanban-column-drag-over');

            const taskId = e.dataTransfer?.getData('application/task-id');
            const taskPath = e.dataTransfer?.getData('application/task-path');
            const oldStatus = e.dataTransfer?.getData('application/task-current-status');

            if (!taskId || !taskPath || oldStatus === this.config.statusSymbol) {
                return;
            }

            // Find the task from all tasks
            const allTasks = this.tasksIntegration.getTasks();
            const task = allTasks.find((t) => t.id === taskId);
            
            if (!task) {
                console.warn(`Task with ID ${taskId} not found`);
                return;
            }

            void this.tasksIntegration.taskUpdater.updateTaskStatus(
                task,
                this.config.statusSymbol,
            );
        };
        cardsContainer.addEventListener('drop', this.dropHandler);
    }

    /**
     * Clean up the column
     */
    destroy() {
        if (this.dragOverHandler) {
            const cardsContainer = this.container.querySelector('.tasks-kanban-column-cards');
            if (cardsContainer) {
                cardsContainer.removeEventListener('dragover', this.dragOverHandler);
            }
            this.dragOverHandler = null;
        }
        
        if (this.dragEnterHandler) {
            const cardsContainer = this.container.querySelector('.tasks-kanban-column-cards');
            if (cardsContainer) {
                cardsContainer.removeEventListener('dragenter', this.dragEnterHandler);
            }
            this.dragEnterHandler = null;
        }
        
        if (this.dragLeaveHandler) {
            const cardsContainer = this.container.querySelector('.tasks-kanban-column-cards');
            if (cardsContainer) {
                cardsContainer.removeEventListener('dragleave', this.dragLeaveHandler);
            }
            this.dragLeaveHandler = null;
        }
        
        if (this.dropHandler) {
            const cardsContainer = this.container.querySelector('.tasks-kanban-column-cards');
            if (cardsContainer) {
                cardsContainer.removeEventListener('drop', this.dropHandler);
            }
            this.dropHandler = null;
        }

        for (const card of this.cards) {
            card.destroy();
        }
        this.cards = [];
    }

    /**
     * Get the column configuration
     */
    getConfig(): KanbanColumnConfig {
        return this.config;
    }
}
