import type { App, EventRef } from 'obsidian';

/**
 * Interface representing a Task from the Tasks plugin
 * This matches the Task class structure from obsidian-tasks
 */
export interface Task {
    status: {
        symbol: string;
        name: string;
        type: string;
    };
    description: string;
    tags: string[];
    priority: number | null;
    dueDate: string | null;
    startDate: string | null;
    scheduledDate: string | null;
    doneDate: string | null;
    recurrence: any | null;
    id: string;
    taskLocation: {
        path: string;
        lineNumber: number;
    };
    originalMarkdown: string;
}

/**
 * Interface for status information
 */
export interface StatusInfo {
    symbol: string;
    name: string;
    type: string;
}

/**
 * Data received from Tasks cache update event
 */
export interface TasksCacheUpdateData {
    tasks: Task[];
    state: string;
}

/**
 * Service for integrating with the Tasks plugin via Obsidian events
 */
export class TasksIntegration {
    public readonly app: App;
    public readonly taskUpdater: TaskUpdater;
    private tasks: Task[] = [];
    private statuses: StatusInfo[] = [];
    private eventRefs: EventRef[] = [];
    private subscribers: ((tasks: Task[]) => void)[] = [];

    constructor(app: App) {
        this.app = app;
        this.taskUpdater = new TaskUpdater(app);
        this.setupEventListeners();
    }

    /**
     * Set up event listeners for Tasks plugin
     */
    private setupEventListeners() {
        // Listen for cache updates from Tasks
        const cacheUpdateRef = this.app.workspace.on(
            'obsidian-tasks-plugin:cache-update',
            (data: TasksCacheUpdateData) => {
                this.tasks = data.tasks || [];
                this.notifySubscribers();
            },
        );
        this.eventRefs.push(cacheUpdateRef);

        // Request initial cache update
        this.requestCacheUpdate();
    }

    /**
     * Request a cache update from Tasks
     */
    private requestCacheUpdate() {
        // Trigger the request cache update event
        this.app.workspace.trigger(
            'obsidian-tasks-plugin:request-cache-update',
            (cacheData: TasksCacheUpdateData) => {
                this.tasks = cacheData.tasks || [];
                this.notifySubscribers();
            },
        );
    }

    /**
     * Subscribe to tasks updates
     */
    subscribe(callback: (tasks: Task[]) => void): () => void {
        this.subscribers.push(callback);
        // Immediately call with current tasks
        callback(this.tasks);
        return () => {
            this.subscribers = this.subscribers.filter((sub) => sub !== callback);
        };
    }

    /**
     * Notify all subscribers of tasks update
     */
    private notifySubscribers() {
        for (const subscriber of this.subscribers) {
            subscriber(this.tasks);
        }
    }

    /**
     * Get current tasks
     */
    getTasks(): Task[] {
        return this.tasks;
    }

    /**
     * Get tasks matching a filter string
     * Basic implementation - filters by status symbol
     */
    getTasksByStatus(statusSymbol: string): Task[] {
        return this.tasks.filter((task) => task.status.symbol === statusSymbol);
    }

    /**
     * Get available statuses from Tasks
     * For now, returns default statuses. Will use StatusRegistry when available.
     */
    getStatuses(): StatusInfo[] {
        if (this.statuses.length > 0) {
            return this.statuses;
        }
        // Default statuses
        return [
            { symbol: ' ', name: 'Todo', type: 'TODO' },
            { symbol: '/', name: 'In Progress', type: 'IN_PROGRESS' },
            { symbol: 'x', name: 'Done', type: 'DONE' },
        ];
    }

    /**
     * Get status by symbol
     */
    getStatusBySymbol(symbol: string): StatusInfo | undefined {
        return this.getStatuses().find((s) => s.symbol === symbol);
    }

    /**
     * Clean up event listeners
     */
    unload() {
        for (const ref of this.eventRefs) {
            this.app.workspace.offref(ref);
        }
        this.eventRefs = [];
        this.subscribers = [];
    }
}
