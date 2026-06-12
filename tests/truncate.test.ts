import { describe, it, expect } from 'vitest';
import { truncate, MAX_CARD_DESCRIPTION_CHARS } from '../src/utils/truncate';

describe('truncate', () => {
    it('returns short strings unchanged', () => {
        expect(truncate('hello', 10)).toBe('hello');
    });

    it('returns a string exactly at the limit unchanged', () => {
        const s = 'a'.repeat(10);
        expect(truncate(s, 10)).toBe(s);
    });

    it('truncates and appends an ellipsis when over the limit', () => {
        // limit counts the visible characters; the ellipsis is added after.
        expect(truncate('abcdefghij', 5)).toBe('abcde…');
    });

    it('trims trailing whitespace before the ellipsis', () => {
        // "abc  defgh" sliced to 4 -> "abc " -> trimEnd -> "abc"
        expect(truncate('abc  defgh', 4)).toBe('abc…');
    });

    it('handles an empty string', () => {
        expect(truncate('', 10)).toBe('');
    });

    it('handles a zero or negative limit by returning just the ellipsis', () => {
        expect(truncate('abc', 0)).toBe('…');
        expect(truncate('abc', -5)).toBe('…');
    });

    it('counts Unicode code points, not UTF-16 units, so emoji are not split', () => {
        // Three rocket emoji, each a surrogate pair; limit of 2 keeps two whole emoji.
        expect(truncate('🚀🚀🚀', 2)).toBe('🚀🚀…');
    });

    it('does not append an ellipsis when an emoji string is within the limit', () => {
        expect(truncate('🚀🚀', 2)).toBe('🚀🚀');
    });

    it('exposes a sane default cap for card descriptions', () => {
        expect(MAX_CARD_DESCRIPTION_CHARS).toBeGreaterThan(0);
    });

    it('uses the default cap when no limit is provided', () => {
        const long = 'x'.repeat(MAX_CARD_DESCRIPTION_CHARS + 50);
        const result = truncate(long);
        expect(result).toBe('x'.repeat(MAX_CARD_DESCRIPTION_CHARS) + '…');
    });
});
