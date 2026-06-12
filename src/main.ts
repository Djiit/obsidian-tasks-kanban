import { Plugin, type WorkspaceLeaf, Notice } from "obsidian";

import { TasksBoardView } from "./views/TasksBoardView";
import { TasksIntegration } from "./services/TasksIntegration";
import {
  DEFAULT_BOARD_STATE,
  type BoardState,
  type LegacyBoardState,
} from "./types/persistence";
import { serializeQuery, withSort, withTags } from "./query/boardQuery";
import { DEFAULT_SORT_STATE } from "./utils/sortTasks";

const VIEW_TYPE = "tasks-board";

/**
 * Build a canonical query string from pre-query persisted fields
 * (`selectedTags`, `sortState`). Returns "" when there is nothing to migrate.
 */
function migrateLegacyQuery(data: LegacyBoardState | null): string {
  if (!data) {
    return "";
  }
  let query = withTags(
    { filters: [], sort: { ...DEFAULT_SORT_STATE } },
    data.selectedTags ?? [],
  );
  if (data.sortState) {
    query = withSort(query, data.sortState);
  }
  return serializeQuery(query);
}

export default class TasksKanbanPlugin extends Plugin {
  private tasksIntegration: TasksIntegration | null = null;
  private boardState: BoardState = DEFAULT_BOARD_STATE;

  async onload() {
    const tasksPlugin = this.app.plugins.getPlugin("obsidian-tasks-plugin");
    if (!tasksPlugin) {
      new Notice(
        "Tasks kanban requires the tasks plugin. Install it from community plugins.",
      );
      return;
    }

    await this.loadBoardState();

    this.tasksIntegration = new TasksIntegration(this.app);

    const tasksIntegration = this.tasksIntegration;
    this.registerView(
      VIEW_TYPE,
      (leaf: WorkspaceLeaf) =>
        new TasksBoardView(leaf, tasksIntegration, {
          get: () => this.boardState,
          save: (state) => this.saveBoardState(state),
        }),
    );

    this.addCommand({
      id: "open-board",
      name: "Open board",
      callback: () => this.activateView(),
    });
  }

  onunload() {
    if (this.tasksIntegration) {
      this.tasksIntegration.unload();
      this.tasksIntegration = null;
    }
  }

  /**
   * Load persisted board state, merged over the defaults so older installs
   * (no data file) and partial data both yield a complete BoardState.
   *
   * Migration: data files written before the canonical-query model only have
   * `selectedTags`/`sortState`. When `query` is absent we synthesize it from
   * those legacy fields so existing boards keep their filters and sort.
   */
  private async loadBoardState() {
    const data = (await this.loadData()) as
      | (Partial<BoardState> & LegacyBoardState)
      | null;
    this.boardState = {
      ...DEFAULT_BOARD_STATE,
      query: data?.query ?? migrateLegacyQuery(data),
      collapsedColumns:
        data?.collapsedColumns ?? DEFAULT_BOARD_STATE.collapsedColumns,
    };
  }

  private async saveBoardState(state: BoardState) {
    this.boardState = state;
    await this.saveData(this.boardState);
  }

  async activateView() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (leaves.length > 0) {
      this.app.workspace.setActiveLeaf(leaves[0]);
      return;
    }

    const rightLeaf = this.app.workspace.getRightLeaf(false);
    if (!rightLeaf) {
      return;
    }
    await rightLeaf.setViewState({
      type: VIEW_TYPE,
      active: true,
    });

    this.app.workspace.setActiveLeaf(
      this.app.workspace.getLeavesOfType(VIEW_TYPE)[0],
    );
  }
}
