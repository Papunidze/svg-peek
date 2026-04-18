import * as vscode from 'vscode';

let panel: vscode.WebviewPanel | undefined;

export function openPreview(svg: string): void {
  if (!panel) {
    panel = vscode.window.createWebviewPanel(
      'svgPeek.preview',
      'SVG Preview',
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: false, retainContextWhenHidden: true }
    );
    panel.onDidDispose(() => {
      panel = undefined;
    });
  } else {
    panel.reveal(vscode.ViewColumn.Beside, true);
  }

  panel.webview.html = render(svg);
}

function render(svg: string): string {
  const safe = svg.replace(/\$\{[^}]*\}/g, '');
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;">
  <style>
    :root { color-scheme: dark light; }
    html, body { height: 100%; margin: 0; }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #1e1e1e;
      background-image:
        linear-gradient(45deg, #2a2a2a 25%, transparent 25%),
        linear-gradient(-45deg, #2a2a2a 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #2a2a2a 75%),
        linear-gradient(-45deg, transparent 75%, #2a2a2a 75%);
      background-size: 20px 20px;
      background-position: 0 0, 0 10px, 10px -10px, -10px 0;
    }
    .frame {
      max-width: 92vw;
      max-height: 92vh;
      display: flex;
      padding: 16px;
    }
    .frame > svg {
      max-width: 100%;
      max-height: 100%;
      height: auto;
      width: auto;
    }
  </style>
</head>
<body>
  <div class="frame">${safe}</div>
</body>
</html>`;
}
