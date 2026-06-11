import type { StatusInfo } from '../services/TasksIntegration';

/**
 * Configuration for a Kanban column.
 * Columns map to a status *type*; a single column may cover several symbols
 * (e.g. both '/' and a custom 'A' can be IN_PROGRESS).
 */
export interface KanbanColumnConfig {
    id: string;
    title: string;
    type: string;
    /** Every status symbol belonging to this column's type */
    symbols: string[];
    /** Symbol written to the task when it is dropped into this column */
    dropSymbol: string;
    color?: string;
}

/**
 * The order in which status-type columns are displayed.
 * NON_TASK is intentionally excluded.
 */
export const TYPE_ORDER = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const;

/**
 * Display labels for each supported status type.
 */
export const TYPE_LABELS: Record<string, string> = {
    TODO: 'Todo',
    IN_PROGRESS: 'In Progress',
    DONE: 'Done',
    CANCELLED: 'Cancelled',
};

/**
 * Build Kanban columns from the vault's configured statuses.
 *
 * Statuses are grouped by type; one column is emitted per supported type that
 * has at least one configured status, in TYPE_ORDER. The first symbol of a type
 * (core statuses come before custom in the input order) becomes the dropSymbol.
 */
export function buildColumns(statuses: StatusInfo[]): KanbanColumnConfig[] {
    const symbolsByType = new Map<string, string[]>();

    for (const status of statuses) {
        if (!TYPE_LABELS[status.type]) {
            // Unsupported type (e.g. NON_TASK) — skip.
            continue;
        }
        const existing = symbolsByType.get(status.type);
        if (existing) {
            existing.push(status.symbol);
        } else {
            symbolsByType.set(status.type, [status.symbol]);
        }
    }

    const columns: KanbanColumnConfig[] = [];
    for (const type of TYPE_ORDER) {
        const symbols = symbolsByType.get(type);
        if (!symbols || symbols.length === 0) {
            continue;
        }
        columns.push({
            id: type.toLowerCase().replace(/_/g, '-'),
            title: TYPE_LABELS[type],
            type,
            symbols,
            dropSymbol: symbols[0],
        });
    }

    return columns;
}
