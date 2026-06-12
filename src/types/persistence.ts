import type { SortState } from "../utils/sortTasks";

/**
 * The slice of board state that survives across board reopens and Obsidian
 * restarts.
 *
 * Filtering and sorting are persisted as a single canonical `query` string (see
 * {@link BoardQuery} / serializeQuery). Folded columns stay a separate concern.
 */
export interface BoardState {
  /** Canonical board query (filters + sort), serialized one instruction per line. */
  query: string;
  /** Column IDs (see KanbanColumnConfig.id) that are currently folded. */
  collapsedColumns: string[];
}

export const DEFAULT_BOARD_STATE: BoardState = {
  query: "",
  collapsedColumns: [],
};

/**
 * The shape of a data file written before the canonical-query model. Read once on
 * load to migrate `selectedTags`/`sortState` into {@link BoardState.query}, then
 * never written again. All fields optional — old files may carry any subset.
 */
export interface LegacyBoardState {
  sortState?: SortState;
  /** Bare tag names (no leading `#`). */
  selectedTags?: string[];
}

/**
 * Accessor passed down to the board so it can read the hydrated state and write
 * changes back, without knowing how (or where) the plugin persists them.
 */
export interface BoardStatePersistence {
  get(): BoardState;
  save(state: BoardState): void | Promise<void>;
}
