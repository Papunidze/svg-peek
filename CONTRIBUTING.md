# Contributing to SVG Peek

Thanks for your interest — bug reports, fixes, and ideas are all welcome. This document covers what you need to get set up and how to land a change.

## Ground rules

- **Open an issue first** for any non-trivial change. A five-minute conversation up front beats a rejected PR.
- **Keep the scope tight.** One logical change per PR. Refactors and features in separate commits.
- **Match the codebase.** Don't introduce new dependencies, formatters, or patterns without a good reason.
- **Accessibility and performance are not optional.** A new feature that hurts either is not ready.

## Development setup

Requirements:

- Node.js 20 or newer
- VS Code 1.116 or newer

```bash
git clone https://github.com/Papunidze/svg-peek.git
cd svg-peek
npm ci
```

Common commands:

| Command                  | What it does                                                 |
| ------------------------ | ------------------------------------------------------------ |
| `npm run watch`          | Watch mode: type-check + bundle rebuild on save              |
| `npm run check-types`    | Run the TypeScript compiler (no emit)                        |
| `npm run lint`           | Run ESLint over `src/`                                       |
| `npm run package`        | Production build into `dist/`                                |
| `npm test`               | Run the extension test suite                                 |

### Running the extension locally

1. Open the repo in VS Code.
2. Press `F5` to launch the **Extension Development Host**.
3. Open a file containing inline `<svg>` to exercise hover, fold, and format.

Reload the host window (`Ctrl+R` / `Cmd+R`) after code changes while watch mode is running.

## Commit style

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add svg-to-React-component extractor
fix: respect template literal interpolations in hover
docs: clarify gutter thumbnail toggle
refactor: cache parsed blocks per document version
```

- Subject in imperative mood, ≤72 chars.
- One logical change per commit.
- Reference issues in the body: `Closes #42`.

## Pull request checklist

Before opening a PR, make sure:

- [ ] `npm run check-types` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes (use `xvfb-run` on Linux)
- [ ] You added or updated tests for the behaviour you changed
- [ ] You updated `CHANGELOG.md` under `## [Unreleased]`
- [ ] You updated the README if user-facing behaviour changed

CI runs the same checks on Linux, macOS, and Windows. A red CI check will block the PR.

## Releasing (maintainers)

1. Move items from `## [Unreleased]` to a new `## [x.y.z] — YYYY-MM-DD` section in `CHANGELOG.md`.
2. Bump the `version` field in `package.json`.
3. Commit: `chore: release vX.Y.Z`.
4. Tag: `git tag vX.Y.Z && git push --follow-tags`.
5. The `Release` workflow will:
   - build the extension,
   - package a `.vsix`,
   - publish to the VS Code Marketplace (requires `VSCE_PAT` secret),
   - publish to Open VSX (requires `OVSX_PAT` secret),
   - create a GitHub Release with the `.vsix` attached and notes extracted from `CHANGELOG.md`.

## Code of conduct

Be kind and assume good intent. Disagreement is fine; personal attacks are not. Harassment, name-calling, or otherwise making the project unwelcoming will get you removed from the issue tracker and any discussion channels.
