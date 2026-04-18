# Changelog

All notable changes to **SVG Peek** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **Format SVG Blocks in File** now produces a clean result even when the `<svg>` tag is embedded mid-line or padded with stray whitespace in a template literal. Children are indented from the line's leading whitespace + one step, `</svg>` sits at the line's leading whitespace, and any stray whitespace between the preceding token (for example, the template literal backtick) and `<svg>` is trimmed so the opening tag lands right where you expect. The formatter is now idempotent across repeated invocations.

## [0.0.1] — 2026-04-18

### Added

- Hover preview for inline `<svg>` blocks in `.svg`, `.xml`, `.html`, `.js`, `.ts`, `.jsx`, `.tsx`, `.vue`, and `.md`.
- **Open in Tab** link in every hover — shows the SVG in a side panel with a transparency checkerboard background.
- Folding regions for every `<svg>` block, plus `Fold All` and `Unfold All` commands.
- Document formatter for `.svg` / `.xml` and a command to format embedded SVG blocks in any other file.
- Optional gutter thumbnails, toggled via the command palette or the `svgPeek.gutter.enabled` setting.

[Unreleased]: https://github.com/Papunidze/svg-peek/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/Papunidze/svg-peek/releases/tag/v0.0.1
