import * as assert from "assert";

import { anchorForSvg, detectIndent, prettyPrint } from "../svg";

suite("detectIndent", () => {
  test("returns empty string when line has no leading whitespace", () => {
    assert.strictEqual(detectIndent("const x = 1;"), "");
  });

  test("captures spaces", () => {
    assert.strictEqual(detectIndent("    <svg>"), "    ");
  });

  test("captures tabs", () => {
    assert.strictEqual(detectIndent("\t\t<svg>"), "\t\t");
  });

  test("captures mixed tabs and spaces", () => {
    assert.strictEqual(detectIndent("\t  <svg>"), "\t  ");
  });
});

suite("anchorForSvg", () => {
  test("no preceding text: start stays at the <svg column", () => {
    // const icon = `<svg ...
    //              ^ col 14
    const line = "const icon = `<svg ...";
    const anchor = anchorForSvg(line, 14);
    assert.strictEqual(anchor.startColumn, 14);
    assert.strictEqual(anchor.baseIndent, "");
  });

  test("preceding text plus stray whitespace: start trims back to end of text", () => {
    // const icon = `     <svg>...
    //              ^          ^ <svg at col 19
    //              col 14 = end of backtick
    const line = "const icon = `     <svg>";
    const anchor = anchorForSvg(line, 19);
    assert.strictEqual(anchor.startColumn, 14);
    assert.strictEqual(anchor.baseIndent, "");
  });

  test("line with leading indent: baseIndent preserves the line's leading whitespace", () => {
    // '  return `<svg ...'
    //            ^ col 10
    const line = "  return `<svg ...";
    const anchor = anchorForSvg(line, 10);
    assert.strictEqual(anchor.startColumn, 10);
    assert.strictEqual(anchor.baseIndent, "  ");
  });

  test("<svg on its own indented line: no trim, baseIndent is the leading whitespace", () => {
    const line = "    <svg>";
    const anchor = anchorForSvg(line, 4);
    assert.strictEqual(anchor.startColumn, 4);
    assert.strictEqual(anchor.baseIndent, "    ");
  });

  test("long gap with preceding text: trims back past the gap", () => {
    //  '  return `                <svg>'
    //             col 10 = backtick,
    //             col 26 = <svg
    const line = "  return `                <svg>";
    const anchor = anchorForSvg(line, 26);
    assert.strictEqual(anchor.startColumn, 10);
    assert.strictEqual(anchor.baseIndent, "  ");
  });

  test("<svg at column 0: no trim, empty baseIndent", () => {
    const anchor = anchorForSvg("<svg>", 0);
    assert.strictEqual(anchor.startColumn, 0);
    assert.strictEqual(anchor.baseIndent, "");
  });

  test("tabs preserved in baseIndent", () => {
    const line = "\treturn `<svg>";
    const anchor = anchorForSvg(line, 9);
    assert.strictEqual(anchor.startColumn, 9);
    assert.strictEqual(anchor.baseIndent, "\t");
  });
});

suite("prettyPrint", () => {
  test("wraps attributes onto separate lines when tag is dense", () => {
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60" viewBox="0 0 200 60"><rect width="200" height="60" fill="#222" /></svg>';
    const output = prettyPrint(input);
    assert.ok(output.startsWith("<svg\n"), "expected <svg to wrap: " + output);
    assert.ok(
      output.includes('  xmlns="http://www.w3.org/2000/svg"'),
      "expected attrs indented by 2 spaces: " + output,
    );
    assert.ok(output.endsWith("</svg>"), "expected to end with </svg>");
  });

  test("keeps <svg at column 0 and </svg> at column 0 when baseIndent is empty", () => {
    const out = prettyPrint("<svg><rect /></svg>");
    assert.ok(out.startsWith("<svg>"));
    const lines = out.split("\n");
    assert.strictEqual(lines[1], "  <rect />");
    assert.strictEqual(lines[lines.length - 1], "</svg>");
  });

  test("baseIndent shifts children and </svg> but leaves first line bare", () => {
    const out = prettyPrint("<svg><rect /></svg>", "  ");
    const lines = out.split("\n");
    // The first line is stripped of baseIndent so the replace can slot it in
    // right after the preceding token (e.g. a template literal backtick).
    assert.strictEqual(lines[0], "<svg>");
    assert.strictEqual(lines[1], "    <rect />");
    assert.strictEqual(lines[lines.length - 1], "  </svg>");
  });

  test("keeps short tags inline", () => {
    const out = prettyPrint('<svg><rect width="1" /></svg>');
    assert.ok(out.includes('<rect width="1" />'));
  });

  test("respects depth with nested tags", () => {
    const out = prettyPrint("<svg><g><rect /></g></svg>");
    const lines = out.split("\n");
    assert.strictEqual(lines[0], "<svg>");
    assert.strictEqual(lines[1], "  <g>");
    assert.strictEqual(lines[2], "    <rect />");
    assert.strictEqual(lines[3], "  </g>");
    assert.strictEqual(lines[4], "</svg>");
  });
});
