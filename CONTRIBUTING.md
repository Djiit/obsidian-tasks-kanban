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

## Supply-chain policy

This project pins its toolchain and npm security settings:

- **npm 12 required.** The `engines` field in `package.json` is enforced with `engine-strict=true` in `.npmrc`, so installs fail on an unsupported Node/npm version.
- **Install scripts are opt-in.** npm 12 blocks dependency lifecycle scripts unless they are listed in the `allowScripts` field of `package.json`. That field is a code-execution permission list: review its diffs in PRs the same way you review lockfile changes.
  - To see unreviewed entries: `npm install-scripts ls`
  - To approve a package you trust: `npm install-scripts approve <pkg>` (writes a version-pinned entry by default — keep it pinned)
  - To explicitly deny: `npm install-scripts deny <pkg>`
- **esbuild bumps require renewal.** Because the esbuild approval is pinned to the reviewed version, upgrading esbuild (e.g. via Dependabot) leaves the postinstall blocked. Re-approve after the bump: `npm install-scripts approve esbuild`.
- **New package versions wait 7 days.** `.npmrc` sets `min-release-age=7`, so a version published less than 7 days ago won't install. This filters most compromised-and-yanked releases. If you genuinely need a fresh release (e.g. an urgent CVE fix), install it knowingly with `npm install <pkg>@<version> --before=<publish-date>` or lower the setting temporarily.
- **No git or remote-tarball dependencies.** `.npmrc` pins `allow-git=none` and `allow-remote=none` (npm 12 defaults) so these code-execution paths stay closed.

## UI changes: attach screenshots or short videos

If your change affects the UI (board layout, cards, lanes, modals, styles), attach a screenshot or a short screen recording to your issue or PR so reviewers can see the result without pulling your branch locally. With the GitHub CLI you can do this from the terminal using `--attach`, which uploads the file and renders it inline:

```bash
# Attach when creating the PR
gh pr create \
  --title "PULL-REQUEST-TITLE" \
  --body-file PATH/TO/BODY-FILE \
  --attach PATH/TO/SCREENSHOT.png \
  --attach PATH/TO/RECORDING.mov

# Or attach to an existing PR or issue
gh pr comment PR-NUMBER --attach PATH/TO/SCREENSHOT.png
```

Tips:

- Repeat `--attach` for multiple files. You can reference the file in your Markdown body with `![description](PATH/TO/IMAGE)` — gh rewrites the local path to the uploaded URL in place.
- Alt text goes after the path as `'PATH/TO/IMAGE#ALT-TEXT'` (not supported for videos).
- Before/after comparisons are especially useful for styling changes.
- See [Attaching files with GitHub CLI](https://docs.github.com/en/github-cli/github-cli/attaching-files-with-github-cli) for the full details and supported file types.

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
