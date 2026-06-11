import { describe, it, expect } from 'vitest';
import { buildColumns } from '../src/utils/statusColumns';
import type { StatusInfo } from '../src/services/TasksIntegration';

// Mirrors the test vault's statusSettings: core first, then custom.
const VAULT_STATUSES: StatusInfo[] = [
    { symbol: ' ', name: 'Todo', type: 'TODO', nextStatusSymbol: 'x' },
    { symbol: 'x', name: 'Done', type: 'DONE', nextStatusSymbol: ' ' },
    { symbol: '/', name: 'In Progress', type: 'IN_PROGRESS', nextStatusSymbol: 'x' },
    { symbol: '-', name: 'Cancelled', type: 'CANCELLED', nextStatusSymbol: ' ' },
    { symbol: 'A', name: 'A', type: 'IN_PROGRESS', nextStatusSymbol: 'x' },
];

describe('buildColumns', () => {
    it('produces one column per type in TYPE_ORDER', () => {
        const columns = buildColumns(VAULT_STATUSES);
        expect(columns.map((c) => c.title)).toEqual([
            'Todo',
            'In Progress',
            'Done',
            'Cancelled',
        ]);
        expect(columns.map((c) => c.type)).toEqual([
            'TODO',
            'IN_PROGRESS',
            'DONE',
            'CANCELLED',
        ]);
    });

    it('groups multiple symbols of the same type into one column', () => {
        const columns = buildColumns(VAULT_STATUSES);
        const inProgress = columns.find((c) => c.type === 'IN_PROGRESS');
        expect(inProgress?.symbols).toEqual(['/', 'A']);
        expect(inProgress?.dropSymbol).toBe('/');
    });

    it('excludes NON_TASK statuses', () => {
        const columns = buildColumns([
            ...VAULT_STATUSES,
            { symbol: 'P', name: 'Pseudo', type: 'NON_TASK' },
        ]);
        expect(columns.some((c) => c.type === 'NON_TASK')).toBe(false);
        expect(columns).toHaveLength(4);
    });

    it('emits no column for a type with no configured status', () => {
        const columns = buildColumns([
            { symbol: ' ', name: 'Todo', type: 'TODO' },
            { symbol: 'x', name: 'Done', type: 'DONE' },
        ]);
        expect(columns.map((c) => c.type)).toEqual(['TODO', 'DONE']);
    });

    it('derives a kebab-case id from the type', () => {
        const columns = buildColumns(VAULT_STATUSES);
        expect(columns.find((c) => c.type === 'IN_PROGRESS')?.id).toBe('in-progress');
    });

    it('returns an empty array for no statuses', () => {
        expect(buildColumns([])).toEqual([]);
    });
});
