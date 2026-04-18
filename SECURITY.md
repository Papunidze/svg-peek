# Security Policy

## Supported versions

SVG Peek is actively maintained from the latest published release. Only the latest minor version receives security fixes.

| Version | Supported |
| ------- | --------- |
| latest  | ✅        |
| older   | ❌        |

## Reporting a vulnerability

**Please do not report security issues as public GitHub issues.**

If you believe you've found a security vulnerability in SVG Peek, report it privately via GitHub's [private vulnerability reporting](https://github.com/Papunidze/svg-peek/security/advisories/new).

Include:

- A description of the issue and its impact
- Steps to reproduce (a minimal repro file is ideal)
- The version of SVG Peek and VS Code you tested on
- Any proof-of-concept code, if applicable

### What to expect

- **Acknowledgement** within 72 hours of the report.
- **Initial assessment** within 7 days, including severity and whether we plan to fix.
- **Fix target**: critical issues are patched and released as soon as a fix is validated; lower-severity issues follow the regular release cadence.
- **Credit**: with your permission, we will credit you in the release notes and security advisory.

## Scope

In scope:

- Code in this repository that runs inside the VS Code extension host.
- Preview rendering (`src/preview.ts`, webview HTML generation).

Out of scope:

- Issues in VS Code itself — report those to [microsoft/vscode](https://github.com/microsoft/vscode/security).
- Issues in upstream npm dependencies — report those to the respective maintainers; we will track and pick up the fix as soon as it ships.

## Hardening notes

Some things worth knowing if you're auditing:

- Webview previews are rendered with a Content Security Policy that forbids scripts and remote resources. SVGs containing `<script>` render inertly.
- All previews are inline data URIs — no temporary files are written to disk.
- Template literal interpolations (`${…}`) are stripped before rendering, so runtime-computed values never execute during preview.
