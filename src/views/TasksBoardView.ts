import { ItemView, type ViewStateResult, type WorkspaceLeaf } from "obsidian";

import { TasksIntegration, type Task } from "../services/TasksIntegration";
import { KanbanBoard } from "../components/KanbanBoard";
import {
  BASE_BOARD_ID,
  type BoardStatePersistence,
} from "../types/persistence";

/**
 * The slice of the plugin a board view needs to resolve its identity into a
 * persistence accessor and a display name. Kept narrow to avoid a circular
 * dependency on the plugin's concrete class.
 */
export interface BoardHost {
  createPersistence(id: string): BoardStatePersistence;
  getBoardName(id: string): string;
}

interface BoardViewState {
  queryId?: string;
}

/**
 * The Kanban board view for displaying Tasks. Each instance is bound to a board
 * id (the base board or a saved query) carried in its view state, so it survives
 * reload and can be matched by {@link TasksKanbanPlugin.activateView}.
 */
export class TasksBoardView extends ItemView {
  private tasksIntegration: TasksIntegration;
  private host: BoardHost;
  private kanbanBoard: KanbanBoard | null = null;
  private unsubscribe: (() => void) | null = null;
  private queryId: string = BASE_BOARD_ID;
  /** Persistence that reads the live queryId, so it stays correct even though
   * Obsidian runs onOpen (which builds the board) before setState sets the id. */
  private readonly persistence: BoardStatePersistence;

  constructor(
    leaf: WorkspaceLeaf,
    tasksIntegration: TasksIntegration,
    host: BoardHost,
  ) {
    super(leaf);
    this.tasksIntegration = tasksIntegration;
    this.host = host;
    this.persistence = {
      get: () => this.host.createPersistence(this.queryId).get(),
      getBaseQuery: () =>
        this.host.createPersistence(this.queryId).getBaseQuery(),
      save: (state) => this.host.createPersistence(this.queryId).save(state),
    };
  }

  getViewType(): string {
    return "tasks-board";
  }

  /** The board id this view is bound to. */
  getQueryId(): string {
    return this.queryId;
  }

  getDisplayText(): string {
    return this.host.getBoardName(this.queryId);
  }

  getIcon(): string {
    return "columns";
  }

  getState(): Record<string, unknown> {
    return { ...super.getState(), queryId: this.queryId };
  }

  async setState(
    state: BoardViewState,
    result: ViewStateResult,
  ): Promise<void> {
    const changed = !!state?.queryId && state.queryId !== this.queryId;
    if (state?.queryId) {
      this.queryId = state.queryId;
    }
    await super.setState(state, result);
    // Obsidian runs onOpen (which builds the board) BEFORE setState supplies the
    // id, so the board was hydrated against the default base query. Now that the
    // real id is known, reload the board's query from persistence.
    if (changed && this.kanbanBoard) {
      this.kanbanBoard.reloadQueryFromPersistence();
    }
  }

  async onOpen() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("tasks-kanban-view");

    // Load the vault's status configuration so columns reflect it
    // (also picks up status-config changes whenever the board is reopened).
    await this.tasksIntegration.loadStatuses();

    // Create the Kanban board. The persistence reads the live queryId, so even
    // though onOpen runs before setState supplies it, a later reload picks up
    // the correct query (see setState).
    this.kanbanBoard = new KanbanBoard(
      containerEl,
      this.app,
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
   * Refresh the view with current tasks and query
   */
  refresh() {
    if (this.kanbanBoard) {
      this.kanbanBoard.reloadQueryFromPersistence();
      const tasks = this.tasksIntegration.getTasks();
      this.kanbanBoard.updateTasks(tasks);
    }
  }
}
