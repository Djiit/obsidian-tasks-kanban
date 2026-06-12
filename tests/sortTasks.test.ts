import { describe, it, expect } from 'vitest';
import {
    sortTasks,
    DEFAULT_SORT_STATE,
    SORT_FIELD_LABELS,
    type SortState,
} from '../src/utils/sortTasks';
import type { Task } from '../src/services/TasksIntegration';

// Helper to create a mock task
function createTask(overrides: Partial<Task> = {}): Task {
    return {
        id: '1',
        description: 'Test task',
        status: { symbol: ' ', name: 'Todo', type: 'TODO' },
        tags: [],
        priority: null,
        dueDate: null,
        startDate: null,
        scheduledDate: null,
        doneDate: null,
        createdDate: null,
        cancelledDate: null,
        dependsOn: [],
        recurrence: null,
        taskLocation: { path: '/test.md', lineNumber: 1 },
        originalMarkdown: '- [ ] Test task',
        ...overrides,
    };
}

function state(overrides: Partial<SortState> = {}): SortState {
    return { ...DEFAULT_SORT_STATE, ...overrides };
}

const ids = (tasks: Task[]) => tasks.map((t) => t.id);

describe('SORT_FIELD_LABELS', () => {
    it('lists "none" first so it is the default dropdown option', () => {
        expect(Object.keys(SORT_FIELD_LABELS)[0]).toBe('none');
    });
});

describe('sortTasks', () => {
    it('returns a copy, not the same array reference', () => {
        const tasks = [createTask()];
        expect(sortTasks(tasks, state())).not.toBe(tasks);
    });

    it('preserves order and does not mutate input when field is "none"', () => {
        const tasks = [
            createTask({ id: 'b', priority: 5 }),
            createTask({ id: 'a', priority: 0 }),
        ];
        const before = ids(tasks);
        const result = sortTasks(tasks, state({ field: 'none' }));
        expect(ids(result)).toEqual(['b', 'a']);
        expect(ids(tasks)).toEqual(before); // unchanged
    });

    describe('priority', () => {
        it('sorts most important first (0=Highest) ascending', () => {
            const tasks = [
                createTask({ id: 'low', priority: 4 }),
                createTask({ id: 'highest', priority: 0 }),
                createTask({ id: 'medium', priority: 2 }),
            ];
            const result = sortTasks(tasks, state({ field: 'priority' }));
            expect(ids(result)).toEqual(['highest', 'medium', 'low']);
        });

        it('treats null priority as None (3), between medium and low', () => {
            const tasks = [
                createTask({ id: 'low', priority: 4 }),
                createTask({ id: 'none', priority: null }),
                createTask({ id: 'high', priority: 1 }),
            ];
            const result = sortTasks(tasks, state({ field: 'priority' }));
            expect(ids(result)).toEqual(['high', 'none', 'low']);
        });

        it('reverses with descending direction', () => {
            const tasks = [
                createTask({ id: 'highest', priority: 0 }),
                createTask({ id: 'lowest', priority: 5 }),
            ];
            const result = sortTasks(
                tasks,
                state({ field: 'priority', direction: 'desc' }),
            );
            expect(ids(result)).toEqual(['lowest', 'highest']);
        });
    });

    describe('dates', () => {
        it('sorts earliest due date first ascending', () => {
            const tasks = [
                createTask({ id: 'late', dueDate: '2026-03-01' }),
                createTask({ id: 'early', dueDate: '2026-01-01' }),
            ];
            const result = sortTasks(tasks, state({ field: 'dueDate' }));
            expect(ids(result)).toEqual(['early', 'late']);
        });

        it('sorts latest due date first descending', () => {
            const tasks = [
                createTask({ id: 'early', dueDate: '2026-01-01' }),
                createTask({ id: 'late', dueDate: '2026-03-01' }),
            ];
            const result = sortTasks(
                tasks,
                state({ field: 'dueDate', direction: 'desc' }),
            );
            expect(ids(result)).toEqual(['late', 'early']);
        });

        it('sinks tasks with no due date to the bottom when ascending', () => {
            const tasks = [
                createTask({ id: 'none', dueDate: null }),
                createTask({ id: 'dated', dueDate: '2026-01-01' }),
            ];
            const result = sortTasks(tasks, state({ field: 'dueDate' }));
            expect(ids(result)).toEqual(['dated', 'none']);
        });

        it('keeps tasks with no due date at the bottom even when descending', () => {
            const tasks = [
                createTask({ id: 'none', dueDate: null }),
                createTask({ id: 'a', dueDate: '2026-01-01' }),
                createTask({ id: 'b', dueDate: '2026-03-01' }),
            ];
            const result = sortTasks(
                tasks,
                state({ field: 'dueDate', direction: 'desc' }),
            );
            expect(ids(result)).toEqual(['b', 'a', 'none']);
        });

        it('supports other date fields (scheduledDate)', () => {
            const tasks = [
                createTask({ id: 'late', scheduledDate: '2026-05-01' }),
                createTask({ id: 'early', scheduledDate: '2026-02-01' }),
            ];
            const result = sortTasks(tasks, state({ field: 'scheduledDate' }));
            expect(ids(result)).toEqual(['early', 'late']);
        });
    });

    describe('stable tiebreak', () => {
        it('orders equal keys by description', () => {
            const tasks = [
                createTask({ id: '1', description: 'Banana', priority: 1 }),
                createTask({ id: '2', description: 'Apple', priority: 1 }),
            ];
            const result = sortTasks(tasks, state({ field: 'priority' }));
            expect(result.map((t) => t.description)).toEqual(['Apple', 'Banana']);
        });
    });
});
