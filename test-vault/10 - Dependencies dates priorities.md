# Dependencies, dates & priorities

Exercises the full Tasks metadata vocabulary using the **emoji format**, per the
official docs:

- Priority: 🔺 highest · ⏫ high · 🔼 medium · (none) normal · 🔽 low · ⏬ lowest
- Dates: 🛫 start · ⏳ scheduled · 📅 due · ➕ created · ✅ done · ❌ cancelled
- Dependencies: 🆔 `<id>` defines an id · ⛔ `<id>[,<id>]` depends on (blocked by)

> Note: the Kanban card currently renders priority (border), due date (raw), and
> tags. It does NOT yet render start/scheduled/created dates, ids, or
> dependencies. These fixtures confirm such tasks still parse and place correctly,
> and flag fields worth surfacing on the card later.

## All priority levels

- [ ] Highest priority task 🔺 #prio-demo
- [ ] High priority task ⏫ #prio-demo
- [ ] Medium priority task 🔼 #prio-demo
- [ ] Normal priority task (no emoji) #prio-demo
- [ ] Low priority task 🔽 #prio-demo
- [ ] Lowest priority task ⏬ #prio-demo

## All date types

- [ ] Start date only 🛫 2026-06-15 #date-demo
- [ ] Scheduled date only ⏳ 2026-06-16 #date-demo
- [ ] Due date only 📅 2026-06-17 #date-demo
- [ ] Created date only ➕ 2026-06-01 #date-demo
- [x] Done with done date ✅ 2026-06-10 #date-demo
- [-] Cancelled with cancelled date ❌ 2026-06-09 #date-demo
- [ ] Every date at once ➕ 2026-06-01 🛫 2026-06-05 ⏳ 2026-06-08 📅 2026-06-12 #date-demo

## Priority + dates + tags combined

- [/] Ship v1.0 release ⏫ 🛫 2026-06-10 ⏳ 2026-06-12 📅 2026-06-15 #work #release
- [ ] Review security report 🔺 📅 2026-06-13 #work #security

## Task dependencies (id 🆔 + depends-on ⛔)

A linear chain — each task is blocked by the previous one:

- [A] Design the schema 🆔 design-schema 📅 2026-06-12 #project-x
- [ ] Implement the API ⛔ design-schema 🆔 impl-api 📅 2026-06-14 #project-x
- [ ] Write integration tests ⛔ impl-api 🆔 write-tests 📅 2026-06-16 #project-x
- [ ] Ship to production ⛔ write-tests 📅 2026-06-18 #project-x

Multiple dependencies (blocked by two tasks):

- [ ] Set up CI 🆔 setup-ci #project-x
- [ ] Set up CD 🆔 setup-cd #project-x
- [A] Enable auto-deploy ⛔ setup-ci,setup-cd 📅 2026-06-20 #project-x

A blocking task already done — dependent should be unblocked:

- [x] Provision database 🆔 provision-db ✅ 2026-06-09 #project-x
- [ ] Run migrations ⛔ provision-db 📅 2026-06-11 #project-x

## Dependency edge cases

- [ ] Depends on a non-existent id ⛔ does-not-exist 📅 2026-06-15 #dep-edge
- [ ] Self-reference (id == dependsOn) 🆔 loop-a ⛔ loop-a #dep-edge
- [ ] Circular A 🆔 circ-a ⛔ circ-b #dep-edge
- [ ] Circular B 🆔 circ-b ⛔ circ-a #dep-edge
- [ ] Duplicate id (also defined below) 🆔 dup-id #dep-edge
- [ ] Duplicate id (same as above) 🆔 dup-id #dep-edge

## Verification checklist

- [ ] All priority/date/dependency tasks appear in the correct column.
- [ ] No console errors parsing 🆔 / ⛔ signifiers.
- [ ] Cards with start/scheduled/created dates still render (even if those dates
      aren't shown yet).
- [ ] Decide: should the board surface 🆔/⛔ (e.g. a "blocked" badge) and the
      other date types? Track as a follow-up if so.
