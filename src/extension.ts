import * as vscode from 'vscode';
import {
  anchorForSvg,
  describe,
  findSvgs,
  prettyPrint,
  resize,
  svgAt,
  toDataUri,
} from './svg';
import { openPreview, PreviewSource } from './preview';

type PreviewCommandArgs = {
  uri: string;
  line: number;
  character: number;
};

const LANGUAGES = [
  'svg',
  'xml',
  'html',
  'javascript',
  'typescript',
  'javascriptreact',
  'typescriptreact',
  'vue',
  'markdown',
];

const HOVER_SIZE = 180;
const GUTTER_SIZE = 32;

function gutterEnabled(): boolean {
  return vscode.workspace
    .getConfiguration('svgPeek')
    .get<boolean>('gutter.enabled', false);
}

async function setGutter(on: boolean): Promise<void> {
  await vscode.workspace
    .getConfiguration('svgPeek')
    .update('gutter.enabled', on, vscode.ConfigurationTarget.Global);
}

export function activate(context: vscode.ExtensionContext): void {
  const selectors = LANGUAGES.map((language) => ({
    scheme: 'file',
    language,
  }));
  const decorations = new DecorationManager();

  context.subscriptions.push(
    decorations,
    vscode.languages.registerHoverProvider(selectors, { provideHover }),
    vscode.languages.registerFoldingRangeProvider(selectors, {
      provideFoldingRanges,
    }),
    vscode.languages.registerDocumentFormattingEditProvider(
      [
        { scheme: 'file', language: 'svg' },
        { scheme: 'file', language: 'xml' },
      ],
      { provideDocumentFormattingEdits }
    ),
    vscode.commands.registerCommand(
      'svgPeek.openPreview',
      (svg: string, source?: PreviewCommandArgs) => {
        const parsed: PreviewSource | undefined = source
          ? {
              uri: vscode.Uri.parse(source.uri),
              line: source.line,
              character: source.character,
            }
          : undefined;
        openPreview(svg, parsed);
      }
    ),
    vscode.commands.registerCommand('svgPeek.foldAll', () => fold(true)),
    vscode.commands.registerCommand('svgPeek.unfoldAll', () => fold(false)),
    vscode.commands.registerCommand('svgPeek.formatSvgs', formatEmbedded),
    vscode.commands.registerCommand('svgPeek.enableGutter', () => setGutter(true)),
    vscode.commands.registerCommand('svgPeek.disableGutter', () => setGutter(false)),
    vscode.window.onDidChangeActiveTextEditor((editor) =>
      decorations.schedule(editor)
    ),
    vscode.workspace.onDidChangeTextDocument((event) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && event.document === editor.document) {
        decorations.schedule(editor);
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('svgPeek.gutter')) {
        decorations.schedule(vscode.window.activeTextEditor);
      }
    })
  );

  decorations.schedule(vscode.window.activeTextEditor);
}

export function deactivate(): void {}

function provideHover(
  doc: vscode.TextDocument,
  pos: vscode.Position
): vscode.Hover | undefined {
  const match = svgAt(doc, pos);
  if (!match) {
    return;
  }

  const preview = toDataUri(resize(match.svg, HOVER_SIZE));
  const md = new vscode.MarkdownString();
  md.isTrusted = true;
  md.supportHtml = true;
  md.appendMarkdown(`![preview](${preview})\n\n`);
  md.appendMarkdown(`${describe(match.svg)}\n\n`);
  const source: PreviewCommandArgs = {
    uri: doc.uri.toString(),
    line: match.range.start.line,
    character: match.range.start.character,
  };
  const args = encodeURIComponent(JSON.stringify([match.svg, source]));
  md.appendMarkdown(
    `[$(open-preview) Open in Tab](command:svgPeek.openPreview?${args})`
  );

  return new vscode.Hover(md, match.range);
}

function provideFoldingRanges(
  doc: vscode.TextDocument
): vscode.FoldingRange[] {
  return findSvgs(doc)
    .filter((m) => m.range.end.line > m.range.start.line)
    .map(
      (m) =>
        new vscode.FoldingRange(
          m.range.start.line,
          m.range.end.line,
          vscode.FoldingRangeKind.Region
        )
    );
}

function provideDocumentFormattingEdits(
  doc: vscode.TextDocument
): vscode.TextEdit[] {
  const current = doc.getText();
  const formatted = prettyPrint(current);
  if (formatted === current) {
    return [];
  }
  const full = new vscode.Range(
    doc.positionAt(0),
    doc.positionAt(current.length)
  );
  return [vscode.TextEdit.replace(full, formatted)];
}

async function fold(collapse: boolean): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  const ranges = provideFoldingRanges(editor.document);
  if (ranges.length === 0) {
    return;
  }
  await vscode.commands.executeCommand(
    collapse ? 'editor.fold' : 'editor.unfold',
    {
      selectionLines: ranges.map((r) => r.start),
      levels: 1,
    }
  );
}

async function formatEmbedded(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const matches = findSvgs(editor.document);
  if (matches.length === 0) {
    vscode.window.showInformationMessage('SVG Peek: no SVG blocks to format.');
    return;
  }

  let changed = 0;
  await editor.edit((builder) => {
    for (const m of matches) {
      const line = editor.document.lineAt(m.range.start.line).text;
      const { startColumn, baseIndent } = anchorForSvg(
        line,
        m.range.start.character
      );
      const start =
        startColumn === m.range.start.character
          ? m.range.start
          : new vscode.Position(m.range.start.line, startColumn);
      const range = new vscode.Range(start, m.range.end);
      const original = editor.document.getText(range);
      const formatted = prettyPrint(m.svg, baseIndent);
      if (formatted !== original) {
        builder.replace(range, formatted);
        changed++;
      }
    }
  });

  const suffix = changed === 1 ? '' : 's';
  vscode.window.showInformationMessage(
    `SVG Peek: formatted ${changed} SVG block${suffix}.`
  );
}

class DecorationManager implements vscode.Disposable {
  private types: vscode.TextEditorDecorationType[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;

  schedule(editor: vscode.TextEditor | undefined): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => this.apply(editor), 180);
  }

  dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.clear();
  }

  private apply(editor: vscode.TextEditor | undefined): void {
    this.clear();
    if (!editor) {
      return;
    }
    if (!gutterEnabled()) {
      return;
    }
    if (!LANGUAGES.includes(editor.document.languageId)) {
      return;
    }

    const matches = findSvgs(editor.document);
    for (const m of matches) {
      const icon = vscode.Uri.parse(toDataUri(resize(m.svg, GUTTER_SIZE)));
      const type = vscode.window.createTextEditorDecorationType({
        gutterIconPath: icon,
        gutterIconSize: 'contain',
      });
      const anchor = new vscode.Range(m.range.start, m.range.start);
      editor.setDecorations(type, [anchor]);
      this.types.push(type);
    }
  }

  private clear(): void {
    for (const t of this.types) {
      t.dispose();
    }
    this.types = [];
  }
}
