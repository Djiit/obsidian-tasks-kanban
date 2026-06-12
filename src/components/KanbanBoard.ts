import type { Task } from '../services/TasksIntegration';
import { TasksIntegration } from '../services/TasksIntegration';
import { KanbanColumn } from './KanbanColumn';
import { SearchBar } from './SearchBar';
import { SortBar } from './SortBar';
import { TaskFilter } from '../filters/TaskFilter';
import { buildColumns } from '../utils/statusColumns';
import {
    filterTasksBySearch,
    getUniqueTags,
    type SearchState,
} from '../utils/searchFilter';
import {
    sortTasks,
    type SortState,
} from '../utils/sortTasks';
import type { BoardStatePersistence } from '../types/persistence';

export type { KanbanColumnConfig } from '../utils/statusColumns';

/**
 * The Kanban board component
 */
export class KanbanBoard {
    private container: HTMLElement;
    private boardEl!: HTMLElement;
    private tasksIntegration: TasksIntegration;
    private columns: KanbanColumn[] = [];
    private searchBar: SearchBar;
    private sortBar: SortBar;
    private persistence: BoardStatePersistence;
    /** Source of truth: every task last received, before search filtering. */
    private allTasks: Task[] = [];
    /** The tasks currently displayed (after search filtering and sorting). */
    private tasks: Task[] = [];
    private searchState: SearchState;
    private sortState: SortState;
    private filter: TaskFilter;

    constructor(
        container: HTMLElement,
        tasksIntegration: TasksIntegration,
        persistence: BoardStatePersistence,
    ) {
        this.container = container;
        this.tasksIntegration = tasksIntegration;
        this.persistence = persistence;
        this.filter = new TaskFilter();

        // Hydrate from persisted state. The title query always starts empty —
        // it is intentionally not persisted.
        const initial = persistence.get();
        this.sortState = initial.sortState;
        this.searchState = {
            titleQuery: '',
            selectedTags: [...initial.selectedTags],
        };

        // Search and sort controls sit above the board, in a shared header row.
        const header = this.container.createDiv({ cls: 'tasks-kanban-header' });
        this.searchBar = new SearchBar(
            header,
            (state) => {
                this.searchState = state;
                this.persistState();
                this.applySearch();
            },
            initial.selectedTags,
        );
        this.sortBar = new SortBar(
            header,
            (state) => {
                this.sortState = state;
                this.persistState();
                this.applySearch();
            },
            initial.sortState,
        );

        // Initialize default columns (into their own board sub-element)
        this.initColumns();
    }

    /**
     * Persist the slice of state that survives reopens: sort state and selected
     * tags. The title query is deliberately excluded.
     */
    private persistState() {
        void this.persistence.save({
            sortState: this.sortState,
            selectedTags: this.searchState.selectedTags,
        });
    }

    /**
     * Initialize columns derived from the vault's configured statuses
     */
    private initColumns() {
        this.boardEl = this.container.createDiv({ cls: 'tasks-kanban-board' });

        const columnConfigs = buildColumns(this.tasksIntegration.getStatuses());
        for (const config of columnConfigs) {
            const columnEl = this.boardEl.createDiv({
                cls: 'tasks-kanban-column',
            });
            const column = new KanbanColumn(columnEl, config, this.tasksIntegration);
            this.columns.push(column);
        }
    }

    /**
     * Render the board with current tasks
     */
    render() {
        this.updateTasks(this.allTasks);
    }

    /**
     * Update tasks and redistribute across columns
     */
    updateTasks(tasks: Task[]) {
        // Remove duplicates by ID
        this.allTasks = this.removeDuplicateTasks(tasks);
        this.searchBar.setTags(getUniqueTags(this.allTasks));
        this.applySearch();
    }

    /**
     * Remove duplicate tasks based on ID
     */
    private removeDuplicateTasks(tasks: Task[]): Task[] {
        const seenIds = new Set<string>();
        return tasks.filter((task) => {
            const id = task.id || task.originalMarkdown;
            if (seenIds.has(id)) {
                return false;
            }
            seenIds.add(id);
            return true;
        });
    }

    /**
     * Apply the current search state to the source tasks and re-render.
     */
    private applySearch() {
        const filtered = filterTasksBySearch(this.allTasks, this.searchState);
        this.tasks = sortTasks(filtered, this.sortState);
        this.distributeTasks();
    }

    /**
     * Distribute tasks across columns based on their status
     */
    private distributeTasks() {
        for (const column of this.columns) {
            const statusTasks = this.tasks.filter(
                (task) => task.status.type === column.config.type,
            );
            column.updateTasks(statusTasks);
        }
    }

    /**
     * Apply a query-syntax filter to all tasks (Tasks query syntax).
     * Operates on the unfiltered source so repeated calls don't lose tasks.
     */
    applyFilter(filterString: string) {
        const filteredTasks = this.filter.filterTasks(this.allTasks, filterString);
        this.tasks = filteredTasks;
        this.distributeTasks();
    }

    /**
     * Clean up the board
     */
    destroy() {
        this.searchBar.destroy();
        this.sortBar.destroy();
        for (const column of this.columns) {
            column.destroy();
        }
        this.columns = [];
    }
}
