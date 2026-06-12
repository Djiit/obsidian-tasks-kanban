import { describe, it, expect } from 'vitest';
import {
    filterTasksBySearch,
    getUniqueTags,
    normalizeTag,
    type SearchState,
} from '../src/utils/searchFilter';
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

function state(overrides: Partial<SearchState> = {}): SearchState {
    return { titleQuery: '', selectedTags: [], ...overrides };
}

describe('normalizeTag', () => {
    it('strips a leading #', () => {
        expect(normalizeTag('#work')).toBe('work');
    });

    it('leaves a bare tag unchanged', () => {
        expect(normalizeTag('work')).toBe('work');
    });
});

describe('getUniqueTags', () => {
    it('returns an empty array for no tasks', () => {
        expect(getUniqueTags([])).toEqual([]);
    });

    it('dedupes and sorts tags alphabetically', () => {
        const tasks = [
            createTask({ tags: ['work', 'urgent'] }),
            createTask({ id: '2', tags: ['work', 'home'] }),
        ];
        expect(getUniqueTags(tasks)).toEqual(['home', 'urgent', 'work']);
    });

    it('normalizes #-prefixed and bare tags to the same entry', () => {
        const tasks = [
            createTask({ tags: ['#work'] }),
            createTask({ id: '2', tags: ['work'] }),
        ];
        expect(getUniqueTags(tasks)).toEqual(['work']);
    });

    it('handles tasks with no tags', () => {
        const tasks = [createTask({ tags: [] }), createTask({ id: '2', tags: ['a'] })];
        expect(getUniqueTags(tasks)).toEqual(['a']);
    });

    it('sorts case-insensitively', () => {
        const tasks = [createTask({ tags: ['Zebra', 'apple', 'Banana'] })];
        expect(getUniqueTags(tasks)).toEqual(['apple', 'Banana', 'Zebra']);
    });
});

describe('filterTasksBySearch', () => {
    it('returns all tasks for an empty state', () => {
        const tasks = [createTask(), createTask({ id: '2' })];
        const result = filterTasksBySearch(tasks, state());
        expect(result).toHaveLength(2);
    });

    it('returns a copy, not the same array reference', () => {
        const tasks = [createTask()];
        const result = filterTasksBySearch(tasks, state());
        expect(result).not.toBe(tasks);
    });

    describe('title query', () => {
        it('matches description substring case-insensitively', () => {
            const tasks = [
                createTask({ description: 'Write documentation' }),
                createTask({ id: '2', description: 'Fix bugs' }),
            ];
            const result = filterTasksBySearch(tasks, state({ titleQuery: 'WRITE' }));
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('1');
        });

        it('trims surrounding whitespace from the query', () => {
            const tasks = [
                createTask({ description: 'Write docs' }),
                createTask({ id: '2', description: 'Fix bugs' }),
            ];
            const result = filterTasksBySearch(tasks, state({ titleQuery: '  write  ' }));
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('1');
        });

        it('returns nothing when no description matches', () => {
            const tasks = [createTask({ description: 'abc' })];
            const result = filterTasksBySearch(tasks, state({ titleQuery: 'xyz' }));
            expect(result).toHaveLength(0);
        });
    });

    describe('tag filter', () => {
        it('matches a single selected tag', () => {
            const tasks = [
                createTask({ tags: ['work'] }),
                createTask({ id: '2', tags: ['home'] }),
            ];
            const result = filterTasksBySearch(tasks, state({ selectedTags: ['work'] }));
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('1');
        });

        it('uses OR across multiple selected tags', () => {
            const tasks = [
                createTask({ id: '1', tags: ['work'] }),
                createTask({ id: '2', tags: ['home'] }),
                createTask({ id: '3', tags: ['urgent'] }),
            ];
            const result = filterTasksBySearch(
                tasks,
                state({ selectedTags: ['work', 'home'] }),
            );
            expect(result.map((t) => t.id)).toEqual(['1', '2']);
        });

        it('normalizes #-prefixed selections against bare task tags', () => {
            const tasks = [createTask({ tags: ['work'] })];
            const result = filterTasksBySearch(tasks, state({ selectedTags: ['#work'] }));
            expect(result).toHaveLength(1);
        });

        it('excludes tasks with no tags when a tag is selected', () => {
            const tasks = [createTask({ tags: [] })];
            const result = filterTasksBySearch(tasks, state({ selectedTags: ['work'] }));
            expect(result).toHaveLength(0);
        });
    });

    describe('combined title AND tags', () => {
        it('requires both the title and a tag to match', () => {
            const tasks = [
                createTask({ id: '1', description: 'Write docs', tags: ['work'] }),
                createTask({ id: '2', description: 'Write docs', tags: ['home'] }),
                createTask({ id: '3', description: 'Fix bugs', tags: ['work'] }),
            ];
            const result = filterTasksBySearch(
                tasks,
                state({ titleQuery: 'write', selectedTags: ['work'] }),
            );
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('1');
        });
    });
});
