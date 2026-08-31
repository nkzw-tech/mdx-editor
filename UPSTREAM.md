# Upstream

This package is a source fork of [`@mdxeditor/editor`](https://github.com/mdx-editor/editor).

- Source baseline: `4.0.4`
- Baseline tag: `v4.0.4`
- Baseline commit: `d0990c33be0441c841232613d03bde16447b8203`
- Last reviewed upstream tag: `v4.2.3`
- Last reviewed upstream commit: `300dfd5520da0fe598c867ca0ae8087f8434bbcc`
- License: MIT, retained in `LICENSE`

## Upstream sync through 4.2.3

The following runtime changes were carried over with upstream authorship or an
explicit upstream commit reference:

- Lexical compatibility hardening from `90a1466`, including sanitized link
  preview navigation and resilient code block deserialization.
- Selection Markdown export from `a7c3bae`.
- State-backed search and replacement from `b108652`, plus the relevant
  normalization hardening from `859bf45`.
- Configured heading shortcuts from `beacb4c`.
- Block-level frontmatter nodes from `ebc4755`.
- Links on selected images from `d8c442b`.
- Stale table action guards from `1b43250`.
- JSX kind mismatch handling from `a5f5763`.

Documentation, examples, browser-test infrastructure, npm lockfile changes,
and dependency-only commits were not copied. The dependency security changes
are superseded by this package's newer dependency versions. The Lexical
extension-session refactor and upstream-only full-height class remain separate
architectural and visual migrations so this fork can preserve its documented
editor lifecycle and scoped styling.

## Maintained changes

- Upgrade all Lexical packages from `0.35.0` to `0.49.0`.
- Use TypeScript's `nodenext` module resolution for package exports.
- Use the canonical Lexical extension horizontal-rule type during Markdown export.
- Fix inline-code delimiter conversion, IME completion, boundary-arrow navigation, and undo behavior.
- Fix first/last list import and caret behavior when removing the first list item.
- Add the `---` plus Enter horizontal-rule shortcut without an extra blank line.
- Refine links, icons, and table editing controls.
- Add a high-level controlled `MarkdownEditor` API and optional persistence adapter.

When syncing upstream, preserve these changes as focused commits and run `pnpm check`.
