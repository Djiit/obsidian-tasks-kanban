import type { SortState } from "../utils/sortTasks";

/**
 * A user-defined column: a named partition over status symbols. The first symbol
 * is the one written to a task dropped into the column (the drop symbol). When a
 * board has no custom columns the default status columns are used instead (see
 * resolveColumns in utils/statusColumns).
 */
export interface ColumnConfig {
  /** Stable identifier (crypto.randomUUID()); also the column-fold key. */
  id: string;
  /** Display name shown in the column header. */
  title: string;
  /** Configured status symbols this column collects; symbols[0] is the drop symbol. */
  symbols: string[];
}

/**
 * A single saved board: a named view. Its `query` holds only the view's own
 * lines (its slice; filters + sort + group); at render time that is merged on
 * top of the shared base query (see {@link PluginData.baseQuery}).
 *
 * `columns` (when non-empty) overrides the default status columns with custom
 * symbol columns; absent/empty means the default status columns are used.
 */
export interface SavedBoard {
  /** Stable identifier (crypto.randomUUID()), used to match open boards. */
  id: string;
  /** Display name, shown in the picker and on the board's tab. */
  name: string;
  /** Canonical query lines for this view's own slice (no base prefix). */
  query: string;
  /** Column IDs (see KanbanColumnConfig.id) folded on this view's board. */
  collapsedColumns: string[];
  /** Group keys (swimlane keys) folded on this view's board. */
  collapsedGroups?: string[];
  /** Custom columns; absent/empty ⇒ default status columns. */
  columns?: ColumnConfig[];
}

/**
 * The persisted plugin data.
 *
 * `baseQuery` is a shared prefix merged into every board (the base board and
 * each saved board). The base board is itself openable as the default view.
 */
export interface PluginData {
  /** Shared query prefix applied to every board. */
  baseQuery: string;
  /** Folded columns for the base-only board. */
  baseCollapsedColumns: string[];
  /** Folded group keys for the base-only board. */
  baseCollapsedGroups: string[];
  /** Custom columns for the base-only board; empty ⇒ default status columns. */
  baseColumns: ColumnConfig[];
  /** User-managed saved boards (views). */
  savedBoards: SavedBoard[];
}

/** Reserved id for the base-only board (the default view). */
export const BASE_BOARD_ID = "__base__";

export const DEFAULT_PLUGIN_DATA: PluginData = {
  baseQuery: "",
  baseCollapsedColumns: [],
  baseCollapsedGroups: [],
  baseColumns: [],
  savedBoards: [],
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
  /** Single-query model that preceded multiple saved boards. */
  query?: string;
  /** Folded columns under the single-query model. */
  collapsedColumns?: string[];
  /** Pre-rename key for {@link PluginData.savedBoards}; same element shape. */
  savedQueries?: SavedBoard[];
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
  /** Group keys (swimlane keys) currently folded on this board. */
  collapsedGroups: string[];
  /** Custom columns; empty ⇒ default status columns. */
  columns: ColumnConfig[];
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
