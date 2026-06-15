# Status edge cases

Exercises status types that the board does NOT map to a column, plus unusual
symbols. Key risk: tasks whose type isn't TODO/IN_PROGRESS/DONE/CANCELLED
**silently disappear** from the board.

## NON_TASK type (configured as 'b') — expect NOT shown on board

- [b] Bookmark-style entry, NON_TASK type, should be hidden from the board

## Unknown symbols (not in Tasks config) — behavior depends on how Tasks types them

- [!] Important — Tasks usually maps unknown symbols to TODO
- [*] Star symbol
- ["] Quote symbol
- [>] Forwarded / scheduled (often TODO in default themes)
- [<] Scheduling symbol

## Whitespace / empty status

- [ ] Single space (normal Todo)
- [] No space inside brackets (is this even a valid task?)
- [  ] Two spaces inside brackets

## Case sensitivity

- [X] Capital X — should this be Done like lowercase x?
- [A] Capital A — configured custom IN_PROGRESS
- [a] Lowercase a — NOT configured, where does it go?

## Verification checklist

- [ ] The `b` task above is absent from every column.
- [ ] Count badges do not include hidden NON_TASK tasks.
- [ ] No console errors when an unmapped type is present.
