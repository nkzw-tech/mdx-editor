/**
 * The `@mdxeditor/editor` package exports the MDXEditor React component and a set of plugins and
 * pre-made components for  editing/editor UI.
 *
 * The API Reference is organized around the various features of the editor. Usually, each feature is implemented as a plugin.
 *
 * Several note-worthy types of exports are available:
 *
 * **dollar-suffixed variables** (e.g. `markdown$`, `applyBlockType$`, etc.). These are [reactive Gurx primitives (Cells and Signals)](https://mdx-editor.github.io/gurx/)
 * which let you interact with the editor state and extend it with your own custom logic.
 *
 * The MDXEditor package re-exports Gurx's React hooks, so you can use them like this for example:
 * ```tsx
 * // use the markdown$ cell to get the current markdown value,
 * // and the rootEditor$ cell to get the Lexical editor instance.
 * const [markdown, rootEditor] = useCellValues([markdown$, rootEditor$])
 * // use the applyBlockType$ signal to apply a block type to the current selection
 * const applyBlockType = usePublisher(applyBlockType$)
 * ```
 *
 * **dollar-prefixed functions** (e.g. `$isCodeBlockNode`, etc.). These are following the conventions of the Lexical API, and are usually usable within the Lexical editor read/update cycles.
 *
 * **`plugin` functions** - these are functions that return a plugin object that can be passed to the `plugins` prop of the MDXEditor component. They usually accept a set of configuration options specific to the features they provide.
 *
 * **MDAST Nodes, Lexical Nodes and Import/Export visitors** - these are part of the bi-directional Markdown to/from Lexical state conversion API.
 *
 * **Toolbar plugins and primitives** - React components that can be used in the Editor toolbar. The primitives are meant to be used to build your own toolbar items.
 *
 * @packageDocumentation
 */
export * from '@mdxeditor/gurx'
// editor component
export * from './MDXEditor.js'
export * from './defaultSvgIcons.js'

// import/export
export * from './importMarkdownToLexical.js'
export * from './exportMarkdownFromLexical.js'

// core so that you can build your own plugins
export * from './plugins/core/index.js'

// basics
export * from './plugins/headings/index.js'
export * from './plugins/thematic-break/index.js'
export * from './plugins/lists/index.js'
export * from './plugins/table/index.js'
export * from './plugins/link/index.js'
export * from './plugins/image/index.js'
export * from './plugins/frontmatter/index.js'
export * from './plugins/quote/index.js'
export * from './plugins/maxlength/index.js'

// JSX
export * from './plugins/jsx/index.js'
export * from './jsx-editors/GenericJsxEditor.js'

// code blocks
export * from './plugins/codemirror/index.js'
export * from './plugins/codemirror/CodeMirrorEditor.js'
export * from './plugins/codeblock/index.js'

// directives
export * from './plugins/directives/index.js'
export * from './directive-editors/AdmonitionDirectiveDescriptor.js'
export * from './directive-editors/GenericDirectiveEditor.js'

// UI
export * from './plugins/link-dialog/index.js'

export * from './plugins/toolbar/index.js'

export * from './plugins/diff-source/index.js'
export * from './plugins/markdown-shortcut/index.js'

export * from './plugins/search/index.js'

// Toolbar components
export * from './plugins/toolbar/components/BlockTypeSelect.js'
export * from './plugins/toolbar/components/BoldItalicUnderlineToggles.js'
export * from './plugins/toolbar/components/ChangeAdmonitionType.js'
export * from './plugins/toolbar/components/ChangeCodeMirrorLanguage.js'
export * from './plugins/toolbar/components/CodeToggle.js'
export * from './plugins/toolbar/components/HighlightToggle.js'
export * from './plugins/toolbar/components/CreateLink.js'
export * from './plugins/toolbar/components/DiffSourceToggleWrapper.js'
export * from './plugins/toolbar/components/InsertAdmonition.js'
export * from './plugins/toolbar/components/InsertCodeBlock.js'
export * from './plugins/toolbar/components/InsertFrontmatter.js'
export * from './plugins/toolbar/components/InsertImage.js'
export * from './plugins/toolbar/components/InsertTable.js'
export * from './plugins/toolbar/components/InsertThematicBreak.js'
export * from './plugins/toolbar/components/ListsToggle.js'
export * from './plugins/toolbar/components/UndoRedo.js'
export * from './plugins/toolbar/components/KitchenSinkToolbar.js'

// Build your own toolbar items
export * from './plugins/toolbar/primitives/toolbar.js'
export * from './plugins/toolbar/primitives/DialogButton.js'
export * from './plugins/toolbar/primitives/TooltipWrap.js'
export * from './plugins/toolbar/primitives/select.js'

// Build your own editor
export * from './plugins/core/NestedLexicalEditor.js'
export * from './plugins/core/PropertyPopover.js'
export * from './plugins/remote/index.js'

// Helpers & utilities
export * from './utils/detectMac.js'
export * from './utils/fp.js'
export * from './utils/isPartOftheEditorUI.js'
export * from './utils/lexicalHelpers.js'
export * from './utils/makeHslTransparent.js'
export * from './utils/uuid4.js'
export * from './utils/voidEmitter.js'

export * from './RealmWithPlugins.js'

export * from './FormatConstants.js'

export * from './styles/lexicalTheme.js'

import * as lexical from 'lexical'
export { lexical }
