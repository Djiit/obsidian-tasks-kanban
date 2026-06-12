import { DEFAULT_SORT_STATE, type SortState } from "../utils/sortTasks";

/**
 * The slice of board UI state that survives across board reopens and Obsidian
 * restarts. The free-text title query is intentionally excluded — it always
 * starts empty so a reopened board never carries a hidden text filter.
 */
export interface BoardState {
  sortState: SortState;
  /** Bare tag names (no leading `#`), matching SearchState.selectedTags. */
  selectedTags: string[];
}

export const DEFAULT_BOARD_STATE: BoardState = {
  sortState: DEFAULT_SORT_STATE,
  selectedTags: [],
};

/**
 * Accessor passed down to the board so it can read the hydrated state and write
 * changes back, without knowing how (or where) the plugin persists them.
 */
export interface BoardStatePersistence {
  get(): BoardState;
  save(state: BoardState): void | Promise<void>;
}
