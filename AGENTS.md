# Development Instructions

- Keep the default `MarkdownEditor` API persistence-free. File or network synchronization belongs in the optional `@nkzw/mdx-editor/persistence` entry point.
- Preserve the editor behavior documented in `UPSTREAM.md` and covered by `src/test/editor-behavior.test.tsx`.
- Keep all Lexical packages on exactly the same version.
- Scope package styling beneath `.nkzw-mdx-editor` or `.nkzw-mdx-editor-shell` and expose customization through `--mdx-editor-*` variables.
- Run `pnpm check` after code changes.
- When syncing upstream, retain attribution and organize upstream, Lexical upgrade, editing behavior, and visual changes as separate commits where practical.
