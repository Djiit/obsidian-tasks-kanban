/**
 * Maximum number of characters shown for a task description on a card.
 * Keeps cards from growing unbounded vertically when a task has a very long
 * description. The full text remains available via the card's title tooltip.
 */
export const MAX_CARD_DESCRIPTION_CHARS = 120;

const ELLIPSIS = "…";

/**
 * Truncate a string to at most `limit` visible characters, appending an
 * ellipsis when content was removed.
 *
 * Length is measured in Unicode code points (via Array.from), so multi-byte
 * characters such as emoji are never split across the boundary. Any whitespace
 * left dangling at the cut is trimmed before the ellipsis is added.
 */
export function truncate(
  text: string,
  limit: number = MAX_CARD_DESCRIPTION_CHARS,
): string {
  if (limit <= 0) {
    return ELLIPSIS;
  }

  const chars = Array.from(text);
  if (chars.length <= limit) {
    return text;
  }

  return chars.slice(0, limit).join("").trimEnd() + ELLIPSIS;
}
