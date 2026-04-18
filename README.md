# SVG Peek

Preview, format, and fold inline SVG in any file — without leaving the editor.

Inline `<svg>` blocks in HTML, JSX, TSX, Vue, Markdown, and template literals inside `.ts` / `.js` become first-class citizens: you can hover to see the rendered image, collapse them so they stop cluttering your code, and pretty-print them with one command.

## Features

### Hover preview
Hover anywhere inside an `<svg>…</svg>` block and see it rendered, along with its dimensions and file size. Works in:
- `.svg`, `.xml`, `.html`
- `.js`, `.ts`, `.jsx`, `.tsx`, `.vue`
- `.md` (including fenced code blocks)

Template literal interpolations (`${foo}`) are stripped for the preview, so your runtime-templated SVGs still render as thumbnails.

### Open in Tab
Each hover popup includes an **Open in Tab** link. Click it to open the selected SVG in a side panel with a transparency checkerboard background — great for inspecting transparent regions and seeing the full render.

### Fold and unfold
Long `<svg>` blocks (hundreds of `<path d="…">` lines) make files hard to read. SVG Peek registers a folding region for every `<svg>` so you can collapse them individually via the gutter arrow, or bulk-collapse via the command palette.

### Gutter thumbnails (opt-in)
Enable `svgPeek.gutter.enabled` (or run **SVG Peek: Enable Gutter Thumbnails**) and a small rendered thumbnail of each SVG appears in the gutter next to its opening tag. Always visible, like the built-in color swatches in settings.json.

### Format
A deterministic SVG pretty-printer: one element per line, attributes wrap when the tag is dense. Registered as a document formatter for `.svg` and `.xml` (works with `editor.formatOnSave`). For embedded SVGs inside `.ts` / `.js` / `.jsx` / `.tsx`, run **SVG Peek: Format SVG Blocks in File** — it reformats only the `<svg>` regions and leaves surrounding code untouched.

## Commands

All commands are available from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | What it does |
| --- | --- |
| `SVG Peek: Fold All SVGs in File` | Collapse every `<svg>` block in the active editor |
| `SVG Peek: Unfold All SVGs in File` | Expand every `<svg>` block |
| `SVG Peek: Format SVG Blocks in File` | Pretty-print every `<svg>` block in the active editor |
| `SVG Peek: Enable Gutter Thumbnails` | Turn on inline gutter previews |
| `SVG Peek: Disable Gutter Thumbnails` | Turn them off |

No default keyboard shortcuts. Assign your own via **Preferences: Open Keyboard Shortcuts** and search `svgPeek`.

## Settings

Only one setting is exposed:

```jsonc
{
  "svgPeek.gutter.enabled": false
}
```

Toggle from the command palette, or edit `settings.json` directly. Changes apply live.

## Installation

### From the Marketplace
1. Open the **Extensions** view (`Ctrl+Shift+X`).
2. Search for **SVG Peek**.
3. Click **Install**.

### From a `.vsix` file
```bash
code --install-extension svg-peek-0.0.1.vsix
```

## Usage tips

- **Read a giant SVG-heavy file**: run `SVG Peek: Fold All SVGs in File` and the file collapses to one line per SVG. Hover any line to see the rendered image.
- **Convert a messy one-line SVG into something readable**: run `SVG Peek: Format SVG Blocks in File`, or just save the file if it's `.svg` / `.xml` and you have format-on-save enabled.
- **Find transparency or a specific color**: click **Open in Tab** from any hover to see the SVG on a checkerboard.

## Performance

- SVG blocks are parsed once per document version and cached, so hover, fold, and decoration lookups share the same work.
- Gutter updates are debounced (180 ms), so rapid typing doesn't thrash.
- All previews are inline data URIs — no temporary files, no extra processes.

## Known limitations

- SVGs containing `<script>` or external resources render inertly (CSP blocks scripts in the preview panel) — intentional, for safety.
- Dynamic SVGs with JS-computed children (e.g. React expressions that build attribute values at runtime) render only the template as written, not the runtime result.
- Auto-fold on open is intentionally not supported — bind the fold command to a shortcut or run it on demand.

## Contributing

Issues and pull requests welcome at the repository linked above.

## License

MIT.
