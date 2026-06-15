# Malformed / non-standard tasks

Many of these are NOT valid Tasks-plugin tasks, so they may never appear on the
board at all (Tasks won't emit them). The ones that DO appear are interesting for
the drag-and-drop update path: `TaskUpdater` only matches lines starting with
`- [ ]` (dash bullet). Other bullets will fail to update silently.

## Non-dash bullets — Tasks recognizes these; TaskUpdater regex does NOT

* [ ] Asterisk bullet todo — drag this; status update should FAIL silently
* [/] Asterisk bullet in progress
+ [ ] Plus bullet todo — drag this; status update should FAIL silently
1. [ ] Numbered list todo — drag this; status update should FAIL silently
2. [x] Numbered list done

## Indentation / nesting

- [ ] Parent task
    - [ ] Indented subtask (4 spaces)
	- [ ] Tab-indented subtask
- [ ] Another parent
  - [/] Two-space indented in-progress subtask

## Broken checkbox syntax — likely NOT tasks at all

- [ ] valid baseline
- [ x] Space before x
- [x ] Space after x
- [ ]missing space after bracket
-[ ] Missing space after dash
- [[ ]] Double brackets
- ( ) Parentheses instead of brackets

## Trailing / leading weirdness

- [ ]    Lots of leading spaces in description
- [ ] Trailing spaces in description    
- [ ] Tab	in	the	middle	of	description

## Verification checklist

- [ ] Note which malformed lines actually render as cards.
- [ ] Drag an asterisk/plus/numbered task — confirm it does NOT move (known gap).
- [ ] No crash / no infinite render when these are present.
