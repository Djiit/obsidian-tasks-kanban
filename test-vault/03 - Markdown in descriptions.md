# Markdown & special characters in descriptions

The card renders description via `setText` (plain text), so markdown should appear
**raw** (literal asterisks etc.). This file documents what that looks like and
flags candidates for future MarkdownRenderer support.

## Inline formatting (expect raw markup shown)

- [ ] Task with **bold** and *italic* and ~~strikethrough~~
- [ ] Task with `inline code` and a `const x = 1` snippet
- [/] Task with ==highlight== and ^superscript^

## Links

- [ ] Wikilink to [[01 - Happy path]]
- [ ] Markdown link [Obsidian](https://obsidian.md)
- [ ] Bare URL https://obsidian.md
- [ ] Embedded image ![[nonexistent.png]]

## Special characters & HTML-ish

- [ ] Angle brackets <script>alert('xss')</script> should be inert
- [ ] Ampersand & entity &amp; and quotes "double" 'single'
- [ ] Pipe | character and backslash \ and braces {curly}
- [ ] Percent %20 and hash # not-a-tag mid-sentence

## Emoji & unicode

- [ ] Emoji task 🚀🔥✅🎉 and combined 👨‍👩‍👧‍👦
- [ ] Accents: café, naïve, Zürich, piñata
- [ ] CJK: 日本語のタスク 中文任务 한국어 작업
- [ ] RTL: مهمة عربية and עברית task

## Tag-only / formatting collisions

- [ ] #only-a-tag-and-nothing-else
- [ ] Leading #tag then text #work #work-life/balance
