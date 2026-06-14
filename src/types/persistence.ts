import type { SortState } from "../utils/sortTasks";

/**
 * A single saved query: a named view on the board. Its `query` holds only the
 * view's own lines (its slice); at render time it is merged on top of the
 * shared base query (see {@link PluginData.baseQuery}).
 */
export interface SavedQuery {
  /** Stable identifier (crypto.randomUUID()), used to match open boards. */
  id: string;
  /** Display name, shown in the picker and on the board's tab. */
  name: string;
  /** Canonical query lines for this view's own slice (no base prefix). */
  query: string;
  /** Column IDs (see KanbanColumnConfig.id) folded on this view's board. */
  collapsedColumns: string[];
}

/**
 * The persisted plugin data.
 *
 * `baseQuery` is a shared prefix merged into every board (the base board and
 * each saved query). The base board is itself openable as the default view.
 */
export interface PluginData {
  /** Shared query prefix applied to every board. */
  baseQuery: string;
  /** Folded columns for the base-only board. */
  baseCollapsedColumns: string[];
  /** User-managed saved queries (board views). */
  savedQueries: SavedQuery[];
}

/** Reserved id for the base-only board (the default view). */
export const BASE_BOARD_ID = "__base__";

export const DEFAULT_PLUGIN_DATA: PluginData = {
  baseQuery: "",
  baseCollapsedColumns: [],
  savedQueries: [],
};

/**
 * The shape of a data file written before the canonical-query model. Read once on
 * load to migrate `selectedTags`/`sortState` into a query string, then never
 * written again. All fields optional — old files may carry any subset.
 */
export interface LegacyBoardState {
  sortState?: SortState;
  /** Bare tag names (no leading `#`). */
  selectedTags?: string[];
  /** Single-query model that preceded multiple saved queries. */
  query?: string;
  /** Folded columns under the single-query model. */
  collapsedColumns?: string[];
}

/**
 * The own-slice state a single board reads and writes. Filtering and sorting are
 * persisted as a canonical query string; folded columns stay separate.
 */
export interface BoardOwnState {
  /** This view's own query lines (without the base prefix). */
  query: string;
  /** Column IDs currently folded on this board. */
  collapsedColumns: string[];
}

/**
 * Accessor passed down to a board so it can read/write its own slice and read the
 * shared base prefix, without knowing how (or where) the plugin persists them.
 */
export interface BoardStatePersistence {
  /** This board's own slice (query lines + folded columns). */
  get(): BoardOwnState;
  /** The shared base query prefix, merged on top of {@link get}'s query. */
  getBaseQuery(): string;
  /** Persist this board's own slice. Never writes the base prefix. */
  save(state: BoardOwnState): void | Promise<void>;
}
