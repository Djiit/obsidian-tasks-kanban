import { Plugin, type WorkspaceLeaf, Notice } from "obsidian";

import { TasksBoardView } from "./views/TasksBoardView";
import { TasksIntegration } from "./services/TasksIntegration";
import { TasksKanbanSettingsTab } from "./settings/SettingsTab";
import { BoardPickerModal } from "./components/BoardPickerModal";
import {
  BASE_BOARD_ID,
  DEFAULT_PLUGIN_DATA,
  type BoardOwnState,
  type BoardStatePersistence,
  type LegacyBoardState,
  type PluginData,
  type SavedBoard,
} from "./types/persistence";
import {
  createSavedBoard,
  findSavedBoard,
  upsertSavedBoard,
} from "./query/savedBoards";
import {
  EMPTY_QUERY,
  serializeQuery,
  withSort,
  withTags,
} from "./query/boardQuery";

const VIEW_TYPE = "tasks-board";

/**
 * Build a canonical query string from pre-query persisted fields
 * (`selectedTags`, `sortState`). Returns "" when there is nothing to migrate.
 */
function migrateLegacyQuery(data: LegacyBoardState | null): string {
  if (!data) {
    return "";
  }
  let query = withTags(EMPTY_QUERY, data.selectedTags ?? []);
  if (data.sortState) {
    query = withSort(query, data.sortState);
  }
  return serializeQuery(query);
}

export default class TasksKanbanPlugin extends Plugin {
  private tasksIntegration: TasksIntegration | null = null;
  private data: PluginData = DEFAULT_PLUGIN_DATA;

  /** The base query string and saved boards, for the settings tab. */
  getPluginData(): PluginData {
    return this.data;
  }

  /** The list of openable boards: the base board plus each saved board. */
  getBoards(): { id: string; name: string }[] {
    return [
      { id: BASE_BOARD_ID, name: "Board" },
      ...this.data.savedBoards.map((b) => ({ id: b.id, name: b.name })),
    ];
  }

  /** Display name for a board id (falls back to "Board" for unknown ids). */
  getBoardName(id: string): string {
    if (id === BASE_BOARD_ID) {
      return "Board";
    }
    return findSavedBoard(this.data.savedBoards, id)?.name ?? "Board";
  }

  /**
   * Build a persistence accessor scoped to a single board. Reads/writes the base
   * record when `id === BASE_BOARD_ID`, otherwise the matching saved board. The
   * base prefix is always exposed via getBaseQuery and never written from a board.
   */
  createPersistence(id: string): BoardStatePersistence {
    const getBaseQuery = () => this.data.baseQuery;
    if (id === BASE_BOARD_ID) {
      return {
        getBaseQuery,
        get: () => ({
          query: this.data.baseQuery,
          collapsedColumns: this.data.baseCollapsedColumns,
          collapsedGroups: this.data.baseCollapsedGroups,
        }),
        save: (state: BoardOwnState) => {
          this.data = {
            ...this.data,
            baseQuery: state.query,
            baseCollapsedColumns: state.collapsedColumns,
            baseCollapsedGroups: state.collapsedGroups,
          };
          return this.saveData(this.data);
        },
      };
    }
    return {
      getBaseQuery,
      get: () => {
        const saved = findSavedBoard(this.data.savedBoards, id);
        return {
          query: saved?.query ?? "",
          collapsedColumns: saved?.collapsedColumns ?? [],
          collapsedGroups: saved?.collapsedGroups ?? [],
        };
      },
      save: (state: BoardOwnState) => {
        const saved = findSavedBoard(this.data.savedBoards, id);
        if (!saved) {
          return;
        }
        this.data = {
          ...this.data,
          savedBoards: upsertSavedBoard(this.data.savedBoards, {
            ...saved,
            query: state.query,
            collapsedColumns: state.collapsedColumns,
            collapsedGroups: state.collapsedGroups,
          }),
        };
        return this.saveData(this.data);
      },
    };
  }

  /**
   * Persist the base query and the saved-board list (from the settings tab), then
   * refresh open boards and close any whose saved board was deleted.
   */
  async saveSettings(baseQuery: string, savedBoards: SavedBoard[]) {
    this.data = { ...this.data, baseQuery, savedBoards };
    await this.saveData(this.data);

    const validIds = new Set([
      BASE_BOARD_ID,
      ...savedBoards.map((b) => b.id),
    ]);
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      const view = leaf.view;
      if (!(view instanceof TasksBoardView)) {
        continue;
      }
      if (!validIds.has(view.getQueryId())) {
        leaf.detach();
      } else {
        view.refresh();
      }
    }
  }

  /**
   * Create a fresh blank saved board, persist it, and open it — a scratch view
   * the user can customize via the bars/modal, then rename or delete in
   * settings. Returns the new board's id.
   */
  async createAndOpenBlankBoard(): Promise<string> {
    const board = createSavedBoard("Untitled board");
    this.data = {
      ...this.data,
      savedBoards: upsertSavedBoard(this.data.savedBoards, board),
    };
    await this.saveData(this.data);
    await this.activateView(board.id);
    return board.id;
  }

  async onload() {
    const tasksPlugin = this.app.plugins.getPlugin("obsidian-tasks-plugin");
    if (!tasksPlugin) {
      new Notice(
        "Tasks kanban requires the tasks plugin. Install it from community plugins.",
      );
      return;
    }

    await this.loadPluginData();

    this.tasksIntegration = new TasksIntegration(this.app);

    this.addSettingTab(new TasksKanbanSettingsTab(this.app, this));

    const tasksIntegration = this.tasksIntegration;
    this.registerView(VIEW_TYPE, (leaf: WorkspaceLeaf) => {
      return new TasksBoardView(leaf, tasksIntegration, {
        createPersistence: (id) => this.createPersistence(id),
        getBoardName: (id) => this.getBoardName(id),
      });
    });

    this.addCommand({
      id: "open-board",
      name: "Open board",
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: "open-saved-query",
      name: "Open saved query…",
      callback: () => {
        new BoardPickerModal(this.app, this.getBoards(), (id) => {
          void this.activateView(id);
        }).open();
      },
    });

    this.addCommand({
      id: "open-blank-board",
      name: "Open new blank board",
      callback: () => {
        void this.createAndOpenBlankBoard();
      },
    });
  }

  onunload() {
    if (this.tasksIntegration) {
      this.tasksIntegration.unload();
      this.tasksIntegration = null;
    }
  }

  /**
   * Load persisted plugin data, merged over defaults so older installs and
   * partial data both yield a complete {@link PluginData}.
   *
   * Migration: data files written before multiple saved queries only carry a
   * single `query`/`collapsedColumns` (or, older still, `selectedTags`/
   * `sortState`). We fold those into the base query so existing boards keep
   * their filters and sort.
   */
  private async loadPluginData() {
    const data = (await this.loadData()) as
      | (Partial<PluginData> & LegacyBoardState)
      | null;
    this.data = {
      baseQuery: data?.baseQuery ?? data?.query ?? migrateLegacyQuery(data),
      baseCollapsedColumns:
        data?.baseCollapsedColumns ??
        data?.collapsedColumns ??
        DEFAULT_PLUGIN_DATA.baseCollapsedColumns,
      baseCollapsedGroups:
        data?.baseCollapsedGroups ?? DEFAULT_PLUGIN_DATA.baseCollapsedGroups,
      // `savedQueries` is the pre-rename key; same element shape, so read it as
      // a fallback to migrate existing data files to `savedBoards`.
      savedBoards:
        data?.savedBoards ??
        data?.savedQueries ??
        DEFAULT_PLUGIN_DATA.savedBoards,
    };
  }

  /**
   * Open the board for `id`, or focus it if already open (one board per id).
   */
  async activateView(id: string = BASE_BOARD_ID) {
    const existing = this.app.workspace
      .getLeavesOfType(VIEW_TYPE)
      .find(
        (leaf) =>
          leaf.view instanceof TasksBoardView &&
          leaf.view.getQueryId() === id,
      );
    if (existing) {
      this.app.workspace.setActiveLeaf(existing);
      return;
    }

    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({
      type: VIEW_TYPE,
      state: { queryId: id },
      active: true,
    });
    this.app.workspace.setActiveLeaf(leaf);
  }
}
