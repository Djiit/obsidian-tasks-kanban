# Contributing to Obsidian Tasks Kanban

Thanks for your interest in improving this plugin! Contributions of all kinds are welcome — bug reports, feature ideas, documentation, and code.

## Open an issue first

**Before submitting a pull request, please [open an issue](https://github.com/Djiit/obsidian-tasks-kanban/issues/new/choose).**

This applies to bug fixes and new features alike. Opening an issue first lets us:

- Confirm the bug or discuss whether the feature fits the plugin's scope
- Agree on an approach before you invest time in code
- Avoid duplicate or conflicting work

For trivial changes (typos, small doc tweaks) a PR without an issue is fine.

Use the [bug report](.github/ISSUE_TEMPLATE/bug_report.md) or [feature request](.github/ISSUE_TEMPLATE/feature_request.md) template when filing an issue.

## Development setup

```bash
# Install dependencies
npm install

# Development build with watch
npm run dev

# Production build (minified)
npm run build
```

See the [Development section of the README](README.md#development) for the full workflow, including Obsidian CLI commands for fast reload during development.

## Before submitting a pull request

Please make sure your changes pass the project's checks:

```bash
npm run lint     # Lint with ESLint
npm test         # Run the test suite (Vitest)
npm run build    # Verify the production build succeeds
npm run format   # Format code with Prettier
```

When you open the PR, GitHub will pre-fill the description from our [pull request template](.github/PULL_REQUEST_TEMPLATE.md) — please fill it out.

Guidelines:

- **Ship tests with your code.** New behavior should be covered by tests in the `tests/` directory.
- **Keep changes minimal and focused.** One concern per PR is easier to review.
- **Reference the issue** your PR addresses (e.g. `Closes #123`).
- **Follow Conventional Commits** for commit messages (e.g. `feat:`, `fix:`, `chore:`). Releases are automated with [release-please](https://github.com/googleapis/release-please), which relies on this convention.

## Code style

- **Language**: TypeScript
- **Build tool**: esbuild
- **Test framework**: Vitest (JSDom environment)
- **Formatting**: Prettier

See [AGENTS.md](AGENTS.md) for detailed architecture notes and conventions.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
