import { describe, it, expect } from 'vitest';
import {
    createSavedQuery,
    findSavedQuery,
    removeSavedQuery,
    upsertSavedQuery,
} from '../src/query/savedQueries';
import type { SavedQuery } from '../src/types/persistence';

function saved(overrides: Partial<SavedQuery> = {}): SavedQuery {
    return {
        id: 'id-1',
        name: 'Query',
        query: '',
        collapsedColumns: [],
        ...overrides,
    };
}

describe('createSavedQuery', () => {
    it('creates an empty query with the given name and a unique id', () => {
        const a = createSavedQuery('Work');
        const b = createSavedQuery('Work');
        expect(a.name).toBe('Work');
        expect(a.query).toBe('');
        expect(a.collapsedColumns).toEqual([]);
        expect(a.id).not.toBe(b.id);
    });
});

describe('findSavedQuery', () => {
    it('returns the matching query', () => {
        const list = [saved({ id: 'a' }), saved({ id: 'b', name: 'B' })];
        expect(findSavedQuery(list, 'b')?.name).toBe('B');
    });

    it('returns undefined when absent', () => {
        expect(findSavedQuery([saved({ id: 'a' })], 'z')).toBeUndefined();
    });
});

describe('upsertSavedQuery', () => {
    it('appends when the id is new', () => {
        const list = [saved({ id: 'a' })];
        const next = upsertSavedQuery(list, saved({ id: 'b' }));
        expect(next.map((q) => q.id)).toEqual(['a', 'b']);
        expect(list).toHaveLength(1); // input not mutated
    });

    it('replaces in place when the id exists', () => {
        const list = [saved({ id: 'a', name: 'old' }), saved({ id: 'b' })];
        const next = upsertSavedQuery(list, saved({ id: 'a', name: 'new' }));
        expect(next.map((q) => q.name)).toEqual(['new', 'Query']);
        expect(next).toHaveLength(2);
    });
});

describe('removeSavedQuery', () => {
    it('removes the matching id', () => {
        const list = [saved({ id: 'a' }), saved({ id: 'b' })];
        expect(removeSavedQuery(list, 'a').map((q) => q.id)).toEqual(['b']);
    });

    it('is a no-op when the id is absent', () => {
        const list = [saved({ id: 'a' })];
        expect(removeSavedQuery(list, 'z')).toEqual(list);
    });
});
