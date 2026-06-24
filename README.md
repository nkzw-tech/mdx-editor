# @nkzw/mdx-editor

A fast, polished inline Markdown editor for React. It is a maintained fork of [`@mdxeditor/editor`](https://github.com/mdx-editor/editor) with upgraded Lexical internals and editing behavior tuned for keyboard-first document and comment authoring.

## Install

```sh
pnpm add @nkzw/mdx-editor
```

```tsx
import { MarkdownEditor } from '@nkzw/mdx-editor'
import '@nkzw/mdx-editor/styles.css'

export function Editor() {
  const [markdown, setMarkdown] = useState('# Hello')

  return <MarkdownEditor onChange={setMarkdown} value={markdown} />
}
```

The default editor includes headings, lists, quotes, links, tables, thematic breaks, fenced code blocks, Markdown shortcuts, and canonical Markdown serialization. It intentionally has no toolbar.

## Embedded editors

```tsx
<MarkdownEditor
  colorScheme="inherit"
  density="compact"
  onChange={setDraft}
  value={draft}
  variant="embedded"
/>
```

Use `onKeyDown` for host application shortcuts and `onHeightChange` when the editor lives inside a virtualized layout.

## Persistence

File and network synchronization are optional:

```tsx
import {
  PersistentMarkdownEditor,
  type MarkdownPersistenceAdapter
} from '@nkzw/mdx-editor/persistence'

const adapter: MarkdownPersistenceAdapter<Document> = {
  async save({ content, document, keepalive }) {
    // Save with document.version as the optimistic concurrency token.
    return { document: await save(content, document, keepalive), status: 'saved' }
  }
}
```

The persistence layer includes debounced saves, a maximum save wait, lifecycle flushing, optimistic concurrency, same-content conflict suppression, disk update reconciliation, and default conflict/error UI.

## Styling

Defaults reproduce the original Notes document editor. Override variables on the editor class:

```css
.comment-editor {
  --mdx-editor-bg: transparent;
  --mdx-editor-border: transparent;
  --mdx-editor-font-size: 13px;
  --mdx-editor-line-height: 1.45;
  --mdx-editor-padding: 9px 10px 10px;
}
```

The primary variables are `--mdx-editor-bg`, `--mdx-editor-border`, `--mdx-editor-text`, `--mdx-editor-muted`, `--mdx-editor-accent`, `--mdx-editor-accent-soft`, `--mdx-editor-code-bg`, `--mdx-editor-hover`, `--mdx-editor-selection`, `--mdx-editor-table-stripe`, `--mdx-editor-font`, `--mdx-editor-mono-font`, `--mdx-editor-radius`, `--mdx-editor-padding`, `--mdx-editor-font-size`, and `--mdx-editor-line-height`.

## Advanced API

The complete low-level fork is available from:

```ts
import { MDXEditor, realmPlugin } from '@nkzw/mdx-editor/core'
```

See [UPSTREAM.md](./UPSTREAM.md) for the upstream baseline and maintained patch set.

## License

MIT. Original MDXEditor copyright and license are retained in [LICENSE](./LICENSE).
