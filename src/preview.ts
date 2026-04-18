import { randomBytes } from "crypto";
import * as vscode from "vscode";
import { findSvgs } from "./svg";

export type PreviewSource = {
  uri: vscode.Uri;
  line: number;
  character: number;
};

type PreviewState = {
  svg: string;
  source: PreviewSource | undefined;
};

let panel: vscode.WebviewPanel | undefined;
let state: PreviewState | undefined;
let docListener: vscode.Disposable | undefined;

export function openPreview(svg: string, source?: PreviewSource): void {
  state = { svg, source };

  if (!panel) {
    panel = vscode.window.createWebviewPanel(
      "svgPeek.preview",
      "SVG Preview",
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: true, retainContextWhenHidden: true },
    );
    panel.onDidDispose(() => {
      panel = undefined;
      state = undefined;
      docListener?.dispose();
      docListener = undefined;
    });
    docListener = vscode.workspace.onDidChangeTextDocument(onDocChange);
  } else {
    panel.reveal(vscode.ViewColumn.Beside, true);
  }

  panel.title = deriveTitle(source);
  panel.webview.html = render(svg);
}

function onDocChange(event: vscode.TextDocumentChangeEvent): void {
  if (!panel || !state?.source) {
    return;
  }
  if (event.document.uri.toString() !== state.source.uri.toString()) {
    return;
  }

  const match = pickMatch(event.document, state.source);
  if (!match) {
    return;
  }
  if (match.svg === state.svg) {
    return;
  }
  state = { ...state, svg: match.svg };
  panel.webview.postMessage({ kind: "update", svg: sanitize(match.svg) });
}

function pickMatch(
  doc: vscode.TextDocument,
  source: PreviewSource,
): { svg: string } | undefined {
  const matches = findSvgs(doc);
  if (matches.length === 0) {
    return undefined;
  }
  const anchor = new vscode.Position(source.line, source.character);
  const containing = matches.find((m) => m.range.contains(anchor));
  if (containing) {
    return containing;
  }

  const onSameLine = matches.find((m) => m.range.start.line === source.line);
  return onSameLine;
}

function sanitize(svg: string): string {
  return svg.replace(/\$\{[^}]*\}/g, "");
}

function deriveTitle(source: PreviewSource | undefined): string {
  if (!source) {
    return "SVG Preview";
  }
  const file = source.uri.path.split("/").pop() ?? "SVG";
  return `SVG Preview — ${file}:${source.line + 1}`;
}

function render(svg: string): string {
  const safe = sanitize(svg);
  const nonce = randomBytes(16).toString("hex");
  const csp = [
    `default-src 'none'`,
    `style-src 'unsafe-inline'`,
    `img-src data:`,
    `script-src 'nonce-${nonce}'`,
  ].join("; ");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="${csp};">
  <style>
    :root { color-scheme: dark light; }
    html, body { height: 100%; margin: 0; overflow: hidden; }
    body {
      display: flex;
      flex-direction: column;
      background-color: #1e1e1e;
      background-image:
        linear-gradient(45deg, #2a2a2a 25%, transparent 25%),
        linear-gradient(-45deg, #2a2a2a 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #2a2a2a 75%),
        linear-gradient(-45deg, transparent 75%, #2a2a2a 75%);
      background-size: 20px 20px;
      background-position: 0 0, 0 10px, 10px -10px, -10px 0;
      color: #eee;
      font: 12px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .toolbar {
      position: fixed;
      top: 12px;
      right: 12px;
      display: flex;
      gap: 4px;
      padding: 4px;
      border-radius: 6px;
      background: rgba(24, 24, 24, 0.85);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
      z-index: 2;
      user-select: none;
    }
    .toolbar button {
      background: transparent;
      color: inherit;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 4px;
      padding: 4px 10px;
      cursor: pointer;
      min-width: 30px;
      font-size: 14px;
      line-height: 1;
    }
    .toolbar button:hover { background: rgba(255, 255, 255, 0.08); }
    .toolbar button:active { background: rgba(255, 255, 255, 0.14); }
    .toolbar button:focus-visible { outline: 2px solid #F97316; outline-offset: 1px; }
    .zoom-label {
      align-self: center;
      min-width: 42px;
      text-align: center;
      font-variant-numeric: tabular-nums;
      padding: 0 4px;
    }
    .viewport {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: auto;
    }
    .stage {
      transform-origin: center center;
      transition: transform 0.08s ease-out;
      will-change: transform;
      padding: 16px;
      cursor: zoom-in;
    }
    .stage.shift-down { cursor: zoom-out; }
    .stage > svg {
      max-width: 92vw;
      max-height: 92vh;
      height: auto;
      width: auto;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div class="toolbar" role="toolbar" aria-label="Preview controls">
    <button id="zoom-out" title="Zoom out (Shift+click or scroll down)" aria-label="Zoom out">−</button>
    <div class="zoom-label" id="zoom-label" aria-live="polite">100%</div>
    <button id="zoom-in" title="Zoom in (click or scroll up)" aria-label="Zoom in">+</button>
    <button id="zoom-reset" title="Reset zoom (Ctrl/Cmd+0)" aria-label="Reset zoom">100%</button>
  </div>
  <div class="viewport" id="viewport">
    <div class="stage" id="stage">${safe}</div>
  </div>
  <script nonce="${nonce}">
    (function () {
      const stage = document.getElementById('stage');
      const label = document.getElementById('zoom-label');
      const viewport = document.getElementById('viewport');
      let scale = 1;
      const MIN = 0.1;
      const MAX = 16;
      const FACTOR = 1.2;
      const WHEEL_FACTOR = 1.1;

      function apply() {
        stage.style.transform = 'scale(' + scale.toFixed(3) + ')';
        label.textContent = Math.round(scale * 100) + '%';
      }
      function setScale(next) {
        scale = Math.min(MAX, Math.max(MIN, next));
        apply();
      }
      function multiply(factor) {
        setScale(scale * factor);
      }
      function anchorAt(clientX, clientY) {
        // Set transform-origin to the cursor's percentage within the stage so
        // the zoom visually pivots around the hover/click point.
        const rect = stage.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const px = ((clientX - rect.left) / rect.width) * 100;
        const py = ((clientY - rect.top) / rect.height) * 100;
        const cx = Math.min(100, Math.max(0, px));
        const cy = Math.min(100, Math.max(0, py));
        stage.style.transformOrigin = cx.toFixed(2) + '% ' + cy.toFixed(2) + '%';
      }

      document.getElementById('zoom-in').addEventListener('click', () => {
        stage.style.transformOrigin = 'center center';
        multiply(FACTOR);
      });
      document.getElementById('zoom-out').addEventListener('click', () => {
        stage.style.transformOrigin = 'center center';
        multiply(1 / FACTOR);
      });
      document.getElementById('zoom-reset').addEventListener('click', () => {
        stage.style.transformOrigin = 'center center';
        setScale(1);
      });

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Shift') stage.classList.add('shift-down');
        if (!(e.ctrlKey || e.metaKey)) return;
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          stage.style.transformOrigin = 'center center';
          multiply(FACTOR);
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          stage.style.transformOrigin = 'center center';
          multiply(1 / FACTOR);
        } else if (e.key === '0') {
          e.preventDefault();
          stage.style.transformOrigin = 'center center';
          setScale(1);
        }
      });
      window.addEventListener('keyup', (e) => {
        if (e.key === 'Shift') stage.classList.remove('shift-down');
      });

      // Plain mouse wheel zooms; anchored at the cursor so the point under
      // the pointer stays roughly stationary.
      viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        anchorAt(e.clientX, e.clientY);
        multiply(e.deltaY < 0 ? WHEEL_FACTOR : 1 / WHEEL_FACTOR);
      }, { passive: false });

      // Click to zoom in at the clicked point; Shift+click to zoom out.
      stage.addEventListener('click', (e) => {
        anchorAt(e.clientX, e.clientY);
        multiply(e.shiftKey ? 1 / FACTOR : FACTOR);
      });

      window.addEventListener('message', (ev) => {
        const msg = ev.data;
        if (msg && msg.kind === 'update' && typeof msg.svg === 'string') {
          stage.innerHTML = msg.svg;
        }
      });

      apply();
    })();
  </script>
</body>
</html>`;
}
