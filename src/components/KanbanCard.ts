import type { Task } from '../services/TasksIntegration';
import { TasksIntegration } from '../services/TasksIntegration';
import { truncate } from '../utils/truncate';
import type { App } from 'obsidian';

/**
 * The Kanban card component - represents a single task
 */
export class KanbanCard {
    private container: HTMLElement;
    private task: Task;
    private tasksIntegration: TasksIntegration;
    private app: App;
    private dragStartHandler: ((e: DragEvent) => void) | null = null;
    private clickHandler: ((e: MouseEvent) => void) | null = null;

    constructor(
        container: HTMLElement,
        task: Task,
        tasksIntegration: TasksIntegration,
    ) {
        this.container = container;
        this.task = task;
        this.tasksIntegration = tasksIntegration;
        this.app = tasksIntegration.app;
    }

    /**
     * Render the card
     */
    render() {
        this.container.empty();
        this.container.addClass('tasks-kanban-card');
        this.container.setAttribute('data-task-id', this.task.id);
        this.container.setAttribute('data-task-path', this.task.taskLocation?.path || '');
        this.container.setAttribute('draggable', 'true');

        // Status indicator
        const statusEl = this.container.createSpan({
            cls: 'tasks-kanban-card-status',
        });
        statusEl.setText(this.task.status.symbol);
        statusEl.setAttribute('title', this.task.status.name);
        statusEl.setAttribute('data-status-type', this.task.status.type);

        // Description (capped so a long task can't grow the card unbounded;
        // the full text stays reachable via the tooltip)
        const descEl = this.container.createSpan({
            cls: 'tasks-kanban-card-description',
        });
        const displayText = truncate(this.task.description);
        descEl.setText(displayText);
        if (displayText !== this.task.description) {
            descEl.setAttribute('title', this.task.description);
        }

        // Tags
        if (this.task.tags && this.task.tags.length > 0) {
            const tagsEl = this.container.createDiv({
                cls: 'tasks-kanban-card-tags',
            });
            for (const tag of this.task.tags) {
                tagsEl.createSpan({
                    cls: 'tasks-kanban-card-tag',
                    text: tag,
                });
            }
        }

        // Due date
        if (this.task.dueDate) {
            const dueEl = this.container.createDiv({
                cls: 'tasks-kanban-card-due',
            });
            dueEl.setText(this.task.dueDate);
        }

        // Priority
        if (this.task.priority !== null && this.task.priority !== undefined) {
            this.container.addClass(`tasks-kanban-card-priority-${this.task.priority}`);
        }

        // Add drag start handler
        this.setupDragAndDrop();

        // Add click handler to open the source file
        this.clickHandler = (event: MouseEvent) => {
            event.stopPropagation();
            this.openSourceFile();
        };
        this.container.addEventListener('click', this.clickHandler);
    }

    /**
     * Set up drag and drop for the card
     */
    private setupDragAndDrop() {
        this.dragStartHandler = (e: DragEvent) => {
            if (!e.dataTransfer) return;

            e.dataTransfer.setData('text/plain', this.task.description);
            e.dataTransfer.setData('application/task-path', this.task.taskLocation?.path || '');
            e.dataTransfer.setData('application/task-line', String(this.task.taskLocation?.lineNumber ?? -1));

            // Set the drag image (optional visual feedback)
            if (e.target) {
                e.dataTransfer.setDragImage(e.target as HTMLElement, 0, 0);
            }
            
            // Add visual feedback
            this.container.addClass('tasks-kanban-card-dragging');
            
            // Required for Firefox
            e.dataTransfer.effectAllowed = 'move';
        };
        
        this.container.addEventListener('dragstart', this.dragStartHandler);
        
        // Clean up on drag end
        this.container.addEventListener('dragend', () => {
            this.container.removeClass('tasks-kanban-card-dragging');
        });
    }

    /**
     * Open the source file where this task is located
     */
    private openSourceFile() {
        const filePath = this.task.taskLocation?.path;
        if (filePath && this.app) {
            const file = this.app.vault.getFileByPath(filePath);
            if (file) {
                void this.app.workspace.getLeaf().openFile(file);
            }
        }
    }

    /**
     * Clean up the card
     */
    destroy() {
        if (this.dragStartHandler) {
            this.container.removeEventListener('dragstart', this.dragStartHandler);
            this.dragStartHandler = null;
        }
        
        this.container.removeEventListener('dragend', () => {});
        
        if (this.clickHandler) {
            this.container.removeEventListener('click', this.clickHandler);
            this.clickHandler = null;
        }
        
        this.container.remove();
    }

    /**
     * Get the task associated with this card
     */
    getTask(): Task {
        return this.task;
    }
}
