import { describe, it, expect } from 'vitest';
import { TaskFilter } from '../src/filters/TaskFilter';
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
        recurrence: null,
        taskLocation: { path: '/test.md', lineNumber: 1 },
        originalMarkdown: '- [ ] Test task',
        ...overrides,
    };
}

describe('TaskFilter', () => {
    let filter: TaskFilter;

    beforeEach(() => {
        filter = new TaskFilter();
    });

    describe('empty query', () => {
        it('should return all tasks when query is empty', () => {
            const tasks = [createTask(), createTask({ id: '2' })];
            const result = filter.filterTasks(tasks, '');
            expect(result).toHaveLength(2);
        });

        it('should return all tasks when query is whitespace', () => {
            const tasks = [createTask(), createTask({ id: '2' })];
            const result = filter.filterTasks(tasks, '   ');
            expect(result).toHaveLength(2);
        });
    });

    describe('tag filtering', () => {
        it('should filter by single tag', () => {
            const tasks = [
                createTask({ tags: ['work'] }),
                createTask({ id: '2', tags: ['personal'] }),
                createTask({ id: '3', tags: ['work', 'personal'] }),
            ];
            const result = filter.filterTasks(tasks, '#work');
            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('1');
            expect(result[1].id).toBe('3');
        });

        it('should filter by multiple tags', () => {
            const tasks = [
                createTask({ id: '1', tags: ['work'] }),
                createTask({ id: '2', tags: ['personal'] }),
                createTask({ id: '3', tags: ['work', 'personal'] }),
            ];
            const result = filter.filterTasks(tasks, '#work #personal');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('3');
        });
    });

    describe('path filtering', () => {
        it('should filter by path', () => {
            const tasks = [
                createTask({ taskLocation: { path: '/work/tasks.md', lineNumber: 1 } }),
                createTask({ id: '2', taskLocation: { path: '/personal/tasks.md', lineNumber: 1 } }),
            ];
            const result = filter.filterTasks(tasks, 'path:"work"');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('1');
        });

        it('should handle path without quotes', () => {
            const tasks = [
                createTask({ taskLocation: { path: '/work/tasks.md', lineNumber: 1 } }),
                createTask({ id: '2', taskLocation: { path: '/personal/tasks.md', lineNumber: 1 } }),
            ];
            const result = filter.filterTasks(tasks, 'path:work');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('1');
        });
    });

    describe('status filtering', () => {
        it('should filter by status symbol', () => {
            const tasks = [
                createTask({ status: { symbol: ' ', name: 'Todo', type: 'TODO' } }),
                createTask({ id: '2', status: { symbol: 'x', name: 'Done', type: 'DONE' } }),
                createTask({ id: '3', status: { symbol: '/', name: 'In Progress', type: 'IN_PROGRESS' } }),
            ];
            const result = filter.filterTasks(tasks, 'status:"x"');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('2');
        });

        it('should handle status without quotes', () => {
            const tasks = [
                createTask({ status: { symbol: ' ', name: 'Todo', type: 'TODO' } }),
                createTask({ id: '2', status: { symbol: 'x', name: 'Done', type: 'DONE' } }),
            ];
            const result = filter.filterTasks(tasks, 'status:x');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('2');
        });
    });

    describe('description filtering', () => {
        it('should filter by description text', () => {
            const tasks = [
                createTask({ description: 'Write documentation' }),
                createTask({ id: '2', description: 'Fix bugs' }),
                createTask({ id: '3', description: 'Write tests' }),
            ];
            const result = filter.filterTasks(tasks, 'Write');
            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('1');
            expect(result[1].id).toBe('3');
        });

        it('should be case insensitive', () => {
            const tasks = [
                createTask({ description: 'Write documentation' }),
                createTask({ id: '2', description: 'FIX bugs' }),
            ];
            const result = filter.filterTasks(tasks, 'write');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('1');
        });
    });

    describe('priority filtering', () => {
        it('should filter by priority level', () => {
            const tasks = [
                createTask({ priority: 1 }),
                createTask({ id: '2', priority: 2 }),
                createTask({ id: '3', priority: 3 }),
                createTask({ id: '4', priority: null }),
            ];
            const result = filter.filterTasks(tasks, 'priority:1');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('1');
        });
    });

    describe('combined filters', () => {
        it('should apply multiple filters with AND logic', () => {
            const tasks = [
                createTask({ tags: ['work'], status: { symbol: ' ', name: 'Todo', type: 'TODO' } }),
                createTask({ id: '2', tags: ['work'], status: { symbol: 'x', name: 'Done', type: 'DONE' } }),
                createTask({ id: '3', tags: ['personal'], status: { symbol: ' ', name: 'Todo', type: 'TODO' } }),
            ];
            const result = filter.filterTasks(tasks, '#work status:"x"');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('2');
        });
    });
});
