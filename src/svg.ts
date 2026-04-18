import { Position, Range, TextDocument } from "vscode";

const SVG_RE = /<svg\b[\s\S]*?<\/svg>/gi;

export type SvgMatch = { svg: string; range: Range };

type Token =
  | { kind: "open"; name: string; attrs: [string, string][] }
  | { kind: "close"; name: string }
  | { kind: "self"; name: string; attrs: [string, string][] }
  | { kind: "text"; value: string }
  | { kind: "comment"; value: string }
  | { kind: "decl"; value: string };

const cache = new WeakMap<
  TextDocument,
  { version: number; matches: SvgMatch[] }
>();

export function findSvgs(doc: TextDocument): SvgMatch[] {
  const cached = cache.get(doc);
  if (cached && cached.version === doc.version) {
    return cached.matches;
  }

  const text = doc.getText();
  const matches: SvgMatch[] = [];
  SVG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SVG_RE.exec(text)) !== null) {
    const start = doc.positionAt(m.index);
    const end = doc.positionAt(m.index + m[0].length);
    matches.push({ svg: m[0], range: new Range(start, end) });
  }

  cache.set(doc, { version: doc.version, matches });
  return matches;
}

export function svgAt(doc: TextDocument, pos: Position): SvgMatch | undefined {
  return findSvgs(doc).find((m) => m.range.contains(pos));
}

export function toDataUri(svg: string): string {
  const cleaned = stripInterpolations(svg);
  const encoded = encodeURIComponent(cleaned)
    .replace(/'/g, "%27")
    .replace(/"/g, "%22");
  return `data:image/svg+xml;utf8,${encoded}`;
}

export function resize(svg: string, size: number): string {
  return svg
    .replace(/\swidth\s*=\s*("[^"]*"|'[^']*')/i, "")
    .replace(/\sheight\s*=\s*("[^"]*"|'[^']*')/i, "")
    .replace(/<svg\b/i, `<svg width="${size}" height="${size}"`);
}

export function describe(svg: string): string {
  const w = attr(svg, "width");
  const h = attr(svg, "height");
  const vb = attr(svg, "viewBox");
  const dims =
    w && h
      ? `${w} × ${h}`
      : vb
        ? `${vb.split(/\s+/).slice(2).join(" × ")} (viewBox)`
        : "unknown";
  const bytes = Buffer.byteLength(svg, "utf8");
  const size = bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
  return `\`${dims}\` · \`${size}\``;
}

export function detectIndent(line: string): string {
  return /^[ \t]*/.exec(line)?.[0] ?? "";
}

export type SvgFormatAnchor = {
  startColumn: number;
  baseIndent: string;
};

export function anchorForSvg(line: string, svgColumn: number): SvgFormatAnchor {
  const baseIndent = detectIndent(line);
  const prefix = line.slice(0, svgColumn);
  const trimmedPrefix = prefix.replace(/[ \t]+$/, "");
  const hasPrecedingText = trimmedPrefix.length > baseIndent.length;
  const hasGap = trimmedPrefix.length < prefix.length;
  const startColumn =
    hasPrecedingText && hasGap ? trimmedPrefix.length : svgColumn;
  return { startColumn, baseIndent };
}

export function prettyPrint(svg: string, baseIndent = ""): string {
  const step = "  ";
  const tokens = tokenize(svg);
  const out: string[] = [];
  let depth = 0;

  for (const t of tokens) {
    const pad = baseIndent + step.repeat(depth);
    if (t.kind === "close") {
      depth = Math.max(0, depth - 1);
      out.push(baseIndent + step.repeat(depth) + `</${t.name}>`);
    } else if (t.kind === "self") {
      out.push(pad + renderTag(t.name, t.attrs, true, pad, step));
    } else if (t.kind === "open") {
      out.push(pad + renderTag(t.name, t.attrs, false, pad, step));
      depth++;
    } else if (t.kind === "text") {
      const trimmed = t.value.trim();
      if (trimmed) {
        out.push(pad + trimmed);
      }
    } else {
      out.push(pad + t.value);
    }
  }

  const result = out.join("\n");
  if (baseIndent && result.startsWith(baseIndent)) {
    return result.slice(baseIndent.length);
  }
  return result;
}

function stripInterpolations(svg: string): string {
  return svg.replace(/\$\{[^}]*\}/g, "");
}

function attr(svg: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(
    svg,
  );
  return m?.[2] ?? m?.[3];
}

function tokenize(svg: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < svg.length) {
    if (svg.startsWith("<!--", i)) {
      const end = svg.indexOf("-->", i);
      const stop = end === -1 ? svg.length : end + 3;
      tokens.push({ kind: "comment", value: svg.slice(i, stop) });
      i = stop;
      continue;
    }

    if (svg.startsWith("<?", i) || svg.startsWith("<!", i)) {
      const end = svg.indexOf(">", i);
      const stop = end === -1 ? svg.length : end + 1;
      tokens.push({ kind: "decl", value: svg.slice(i, stop) });
      i = stop;
      continue;
    }

    if (svg[i] === "<") {
      const end = svg.indexOf(">", i);
      if (end === -1) {
        break;
      }
      const raw = svg.slice(i + 1, end).trim();
      i = end + 1;

      if (raw.startsWith("/")) {
        tokens.push({ kind: "close", name: raw.slice(1).trim() });
        continue;
      }

      const selfClosing = raw.endsWith("/");
      const body = selfClosing ? raw.slice(0, -1).trim() : raw;
      const name = body.split(/\s+/)[0];
      const attrs = parseAttrs(body.slice(name.length));
      tokens.push(
        selfClosing
          ? { kind: "self", name, attrs }
          : { kind: "open", name, attrs },
      );
      continue;
    }

    const next = svg.indexOf("<", i);
    const stop = next === -1 ? svg.length : next;
    const value = svg.slice(i, stop);
    if (value.trim()) {
      tokens.push({ kind: "text", value });
    }
    i = stop;
  }

  return tokens;
}

function parseAttrs(src: string): [string, string][] {
  const attrs: [string, string][] = [];
  const re = /([a-zA-Z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    attrs.push([m[1], m[3] ?? m[4] ?? ""]);
  }
  return attrs;
}

function renderTag(
  name: string,
  attrs: [string, string][],
  self: boolean,
  pad: string,
  step: string,
): string {
  const close = self ? " />" : ">";
  if (attrs.length === 0) {
    return `<${name}${close}`;
  }

  const inline = `<${name} ${attrs.map(([k, v]) => `${k}="${v}"`).join(" ")}${close}`;
  if (attrs.length < 3 && inline.length <= 80) {
    return inline;
  }

  const lines = [`<${name}`];
  for (const [k, v] of attrs) {
    lines.push(`${pad}${step}${k}="${v}"`);
  }
  lines.push(pad + (self ? "/>" : ">"));
  return lines.join("\n");
}
