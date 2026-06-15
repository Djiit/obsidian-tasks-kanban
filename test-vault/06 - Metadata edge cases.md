### Metadata edge cases

Priority, dates, tags, recurrence. The card shows priority via a left border
(only 1–3 have CSS), a raw due-date string, and tag pills.

## Priorities (Tasks emoji → numeric)

- [ ] Highest priority 🔺 #prio
- [ ] High priority ⏫ #prio
- [ ] Medium priority 🔼 #prio
- [ ] Normal priority (none) #prio
- [ ] Low priority 🔽 #prio
- [ ] Lowest priority ⏬ #prio

> Note: cards only have CSS for priority classes 1, 2, 3. Verify higher/lower
> priorities don't error and just lack the colored border.

## Dates — valid, edge, and invalid

- [ ] Due today 📅 2026-06-11
- [ ] Due in the past 📅 2020-01-01
- [ ] Due far future 📅 2099-12-31
- [ ] Scheduled date ⏳ 2026-06-20
- [ ] Start date 🛫 2026-06-05
- [ ] Leap day 📅 2024-02-29
- [ ] Invalid date 📅 2026-13-45
- [x] Done with completion date ✅ 2026-06-10
- [ ] Multiple dates 🛫 2026-06-01 ⏳ 2026-06-05 📅 2026-06-10

## Tags — many, nested, weird

- [ ] Many tags #a #b #c #d #e #f #g #h #i #j #k #l
- [ ] Nested tag #work/project/subproject/deep
- [ ] Tag with numbers #2026 #q2-2026
- [ ] Tag with emoji #🔥hot
- [ ] Hyphen and underscore #multi-word_tag

## Recurrence

- [ ] Recurring daily 🔁 every day 📅 2026-06-11
- [ ] Recurring weekly on weekday 🔁 every week on Monday 📅 2026-06-15

## Verification checklist

- [ ] Priority borders show only for high/medium/low (1–3).
- [ ] Invalid date renders as raw text without crashing.
- [ ] Many-tag card wraps tag pills, doesn't overflow.
