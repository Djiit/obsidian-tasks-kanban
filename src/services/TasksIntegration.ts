import type { App, EventRef } from "obsidian";
import { TaskUpdater } from "./TaskUpdater";

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
  createdDate: string | null;
  cancelledDate: string | null;
  recurrence: Record<string, unknown> | null;
  id: string;
  // ⛔ "depends on" — the ids of tasks this one is blocked by. obsidian-tasks'
  // docs vocabulary maps ⛔ to "depends on", so `dependsOn` is the expected
  // cache field; `blockedBy` is a defensive fallback as the runtime payload
  // shape is unverified (see getDependencyChips, which reads either).
  dependsOn: string[];
  blockedBy?: string[];
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
  nextStatusSymbol?: string;
}

/**
 * Shape of a single status as persisted by the Tasks plugin
 */
interface TasksPluginStatus {
  symbol: string;
  name: string;
  type: string;
  nextStatusSymbol?: string;
}

/**
 * Shape of the Tasks plugin's statusSettings
 */
interface TasksStatusSettings {
  coreStatuses?: TasksPluginStatus[];
  customStatuses?: TasksPluginStatus[];
}

/**
 * Default statuses used when the Tasks plugin config can't be read
 */
const DEFAULT_STATUSES: StatusInfo[] = [
  { symbol: " ", name: "Todo", type: "TODO" },
  { symbol: "/", name: "In Progress", type: "IN_PROGRESS" },
  { symbol: "x", name: "Done", type: "DONE" },
];

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
      "obsidian-tasks-plugin:cache-update",
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
      "obsidian-tasks-plugin:request-cache-update",
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
   * Load the status configuration from the Tasks plugin.
   *
   * Reads the in-memory plugin settings first (reflects unsaved changes),
   * then falls back to the persisted data.json. On any failure the cached
   * statuses are left untouched and getStatuses() returns the defaults.
   */
  async loadStatuses(): Promise<void> {
    const settings =
      this.readStatusSettings() ?? (await this.readStatusSettingsFromFile());
    if (!settings) {
      return;
    }

    const flattened = [
      ...(settings.coreStatuses ?? []),
      ...(settings.customStatuses ?? []),
    ]
      .filter(
        (s): s is TasksPluginStatus =>
          Boolean(s) && typeof s.symbol === "string",
      )
      .map((s) => ({
        symbol: s.symbol,
        name: s.name,
        type: s.type,
        nextStatusSymbol: s.nextStatusSymbol,
      }));

    if (flattened.length > 0) {
      this.statuses = flattened;
    }
  }

  /**
   * Read statusSettings from the Tasks plugin's in-memory settings, if exposed
   */
  private readStatusSettings(): TasksStatusSettings | null {
    const plugin = this.app.plugins.getPlugin("obsidian-tasks-plugin") as {
      settings?: { statusSettings?: TasksStatusSettings };
    } | null;
    return plugin?.settings?.statusSettings ?? null;
  }

  /**
   * Read statusSettings from the Tasks plugin's persisted data.json
   */
  private async readStatusSettingsFromFile(): Promise<TasksStatusSettings | null> {
    try {
      const path = `${this.app.vault.configDir}/plugins/obsidian-tasks-plugin/data.json`;
      const raw = await this.app.vault.adapter.read(path);
      const parsed = JSON.parse(raw) as {
        statusSettings?: TasksStatusSettings;
      };
      return parsed.statusSettings ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Get available statuses from Tasks (loaded config, or defaults)
   */
  getStatuses(): StatusInfo[] {
    if (this.statuses.length > 0) {
      return this.statuses;
    }
    return DEFAULT_STATUSES;
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
