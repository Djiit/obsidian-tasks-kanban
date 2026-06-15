# Duplicates & identity

`KanbanBoard.removeDuplicateTasks` dedupes by `task.id || task.originalMarkdown`.
If Tasks doesn't assign ids, two genuinely different tasks with identical markdown
(in different files or different lines) collapse into one card.

This note plus `07b - Duplicates partner.md` contain identical task lines.

## Identical lines within this same file

- [ ] Review pull request
- [ ] Review pull request
- [ ] Review pull request

## Same text, different metadata (should these be distinct?)

- [ ] Standup #monday
- [ ] Standup #tuesday

## Verification checklist

- [ ] Count the "Review pull request" cards on the board.
- [ ] If only one shows, that's the originalMarkdown-dedup collision (known risk).
- [ ] Compare with the identical line in `07b - Duplicates partner.md`.
