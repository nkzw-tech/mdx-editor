# Upstream

This package is a source fork of [`@mdxeditor/editor`](https://github.com/mdx-editor/editor).

- Upstream version: `4.0.4`
- Upstream tag: `v4.0.4`
- Upstream commit: `d0990c33be0441c841232613d03bde16447b8203`
- License: MIT, retained in `LICENSE`

## Maintained changes

- Upgrade all Lexical packages from `0.35.0` to `0.45.0`.
- Use TypeScript's `bundler` module resolution for Lexical's package exports.
- Use the canonical Lexical extension horizontal-rule type during Markdown export.
- Fix inline-code delimiter conversion, IME completion, boundary-arrow navigation, and undo behavior.
- Fix first/last list import and caret behavior when removing the first list item.
- Add the `---` plus Enter horizontal-rule shortcut without an extra blank line.
- Refine links, icons, and table editing controls.
- Add a high-level controlled `MarkdownEditor` API and optional persistence adapter.

When syncing upstream, preserve these changes as focused commits and run `pnpm check`.
