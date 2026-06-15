# Drag and drop targets

Dedicated, well-formed tasks for exercising drag-and-drop status changes. All use
the standard `- [ ]` dash bullet so `TaskUpdater` can rewrite them.

After each drag, confirm the underlying line in THIS file is rewritten with the
target column's drop symbol, and the card reappears in the destination column.

## Move me around

- [ ] DnD: Todo → drag to In Progress (expect symbol `/`)
- [/] DnD: In Progress → drag to Done (expect symbol `x`)
- [x] DnD: Done → drag back to Todo (expect symbol ` `)
- [ ] DnD: Todo → drag to Cancelled (expect symbol `-`)
- [-] DnD: Cancelled → drag to Todo

## Same-column no-op (custom symbol)

- [A] DnD: Active (custom IN_PROGRESS) → drop into In Progress column again.
      Expected: NO write, symbol stays `A` (drop into own type is a no-op).

## Round trip

- [ ] DnD: Round-trip me Todo → In Progress → Done → Todo and confirm the file
      ends back at `- [ ]`.

## Verification checklist

- [ ] File content updates on disk after each successful drop.
- [ ] Dropping into the current column does nothing (no needless write).
- [ ] Custom-symbol task keeps its symbol when dropped into its own type column.
