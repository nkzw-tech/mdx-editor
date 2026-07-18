import { LinkNode, $createLinkNode } from '@lexical/link'
import { $createListItemNode, $createListNode, ListItemNode, ListNode } from '@lexical/list'
import { gfmTaskListItemToMarkdown } from 'mdast-util-gfm-task-list-item'
import React from 'react'
import { render } from '@testing-library/react'
import {
  $createNodeSelection,
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getSelection,
  $getRoot,
  $setSelection,
  createEditor,
  DecoratorNode,
  EditorConfig,
  LexicalEditor,
  NodeKey,
  ParagraphNode,
  SerializedLexicalNode,
  Spread,
  TextNode
} from 'lexical'
import type * as Mdast from 'mdast'
import { describe, expect, it } from 'vitest'
import { MDXEditor, MDXEditorMethods } from '../core.js'
import type { ExportMarkdownFromLexicalOptions, LexicalExportVisitor } from '../exportMarkdownFromLexical.js'
import { LexicalLinebreakVisitor } from '../plugins/core/LexicalLinebreakVisitor.js'
import { LexicalParagraphVisitor } from '../plugins/core/LexicalParagraphVisitor.js'
import { LexicalRootVisitor } from '../plugins/core/LexicalRootVisitor.js'
import { LexicalTextVisitor } from '../plugins/core/LexicalTextVisitor.js'
import { LexicalLinkVisitor } from '../plugins/link/LexicalLinkVisitor.js'
import { LexicalListItemVisitor } from '../plugins/lists/LexicalListItemVisitor.js'
import { LexicalListVisitor } from '../plugins/lists/LexicalListVisitor.js'
import { getSelectionAsMarkdown } from '../utils/lexicalHelpers.js'

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

type SerializedSelectionTestNode = Spread<
  {
    value: string
  },
  SerializedLexicalNode
>

class SelectionTestNode extends DecoratorNode<null> {
  __value: string

  static getType(): string {
    return 'selection-test'
  }

  static clone(node: SelectionTestNode): SelectionTestNode {
    return new SelectionTestNode(node.__value, node.__key)
  }

  static importJSON(serializedNode: SerializedSelectionTestNode): SelectionTestNode {
    return new SelectionTestNode(serializedNode.value)
  }

  constructor(value: string, key?: NodeKey) {
    super(key)
    this.__value = value
  }

  exportJSON(): SerializedSelectionTestNode {
    return { type: 'selection-test', value: this.__value, version: 1 }
  }

  createDOM(_config: EditorConfig): HTMLElement {
    return document.createElement('div')
  }

  updateDOM(): false {
    return false
  }

  decorate(): null {
    return null
  }

  getValue(): string {
    return this.getLatest().__value
  }
}

const SelectionTestVisitor: LexicalExportVisitor<SelectionTestNode, Mdast.Paragraph> = {
  testLexicalNode: (node): node is SelectionTestNode => node instanceof SelectionTestNode,
  visitLexicalNode: ({ lexicalNode, mdastParent, actions }) => {
    actions.appendToParent(mdastParent, {
      type: 'paragraph',
      children: [{ type: 'text', value: `consumer:${lexicalNode.getValue()}` }]
    })
  }
}

const baseVisitors = [
  LexicalRootVisitor,
  LexicalParagraphVisitor,
  LexicalTextVisitor,
  LexicalLinebreakVisitor,
  LexicalLinkVisitor,
  LexicalListVisitor,
  LexicalListItemVisitor
] as unknown as ExportMarkdownFromLexicalOptions['visitors']

function createSelectionEditor() {
  return createEditor({
    namespace: 'selection-markdown-test',
    nodes: [ParagraphNode, TextNode, LinkNode, ListNode, ListItemNode, SelectionTestNode],
    onError(error) {
      throw error
    }
  })
}

function exportParams(
  overrides: Partial<Omit<ExportMarkdownFromLexicalOptions, 'root'>> = {}
): Omit<ExportMarkdownFromLexicalOptions, 'root'> {
  return {
    visitors: baseVisitors,
    toMarkdownExtensions: [gfmTaskListItemToMarkdown()],
    toMarkdownOptions: {},
    jsxComponentDescriptors: [],
    jsxIsAvailable: false,
    ...overrides
  }
}

function readSelection(editor: LexicalEditor) {
  return editor.getEditorState().read(
    () => {
      const selection = $getSelection()
      if (!selection) {
        return null
      }
      return selection.getNodes().map((node) => node.getKey())
    },
    { editor }
  )
}

describe('getSelectionMarkdown public method', () => {
  it('returns empty string when no selection', () => {
    const ref = React.createRef<MDXEditorMethods>()
    render(<MDXEditor ref={ref} markdown="Hello World" />)

    expect(ref.current?.getSelectionMarkdown()).toBe('')
  })

  it('returns empty string for empty markdown', () => {
    const ref = React.createRef<MDXEditorMethods>()
    render(<MDXEditor ref={ref} markdown="" />)

    expect(ref.current?.getSelectionMarkdown()).toBe('')
  })

  it('method exists and is callable', () => {
    const ref = React.createRef<MDXEditorMethods>()
    render(<MDXEditor ref={ref} markdown="Test content" />)

    expect(ref.current?.getSelectionMarkdown).toBeDefined()
    expect(typeof ref.current?.getSelectionMarkdown).toBe('function')
  })
})

describe('getSelectionAsMarkdown', () => {
  it('clips partial text and preserves selected boundary whitespace', () => {
    const editor = createSelectionEditor()

    editor.update(
      () => {
        const text = $createTextNode('zero  bravo  tail')
        $getRoot().append($createParagraphNode().append(text))
        text.select(4, 13)
      },
      { discrete: true }
    )

    expect(getSelectionAsMarkdown(editor, exportParams())).toBe('&#x20; bravo &#x20;')
  })

  it('clips formatted and linked text instead of expanding to whole nodes', () => {
    const editor = createSelectionEditor()
    let boldKey = ''
    let linkTextKey = ''

    editor.update(
      () => {
        const paragraph = $createParagraphNode()
        const bold = $createTextNode('boldness').toggleFormat('bold')
        const linkText = $createTextNode('linked text')
        paragraph.append(bold, $createTextNode(' and '), $createLinkNode('https://example.com').append(linkText))
        $getRoot().append(paragraph)
        boldKey = bold.getKey()
        linkTextKey = linkText.getKey()
        bold.select(0, 4)
      },
      { discrete: true }
    )

    expect(getSelectionAsMarkdown(editor, exportParams())).toBe('**bold**')

    editor.update(
      () => {
        const range = $createRangeSelection()
        range.anchor.set(linkTextKey, 1, 'text')
        range.focus.set(linkTextKey, 6, 'text')
        $setSelection(range)
      },
      { discrete: true }
    )

    expect(boldKey).not.toBe('')
    expect(getSelectionAsMarkdown(editor, exportParams())).toBe('[inked](https://example.com)')
  })

  it('normalizes forward and backward multi-block selections to document order', () => {
    const editor = createSelectionEditor()
    let firstKey = ''
    let secondKey = ''

    editor.update(
      () => {
        const first = $createTextNode('alpha')
        const second = $createTextNode('bravo')
        $getRoot().append($createParagraphNode().append(first), $createParagraphNode().append(second))
        firstKey = first.getKey()
        secondKey = second.getKey()
      },
      { discrete: true }
    )

    const select = (backward: boolean) => {
      editor.update(
        () => {
          const range = $createRangeSelection()
          const start = { key: firstKey, offset: 2 }
          const end = { key: secondKey, offset: 3 }
          const anchor = backward ? end : start
          const focus = backward ? start : end
          range.anchor.set(anchor.key, anchor.offset, 'text')
          range.focus.set(focus.key, focus.offset, 'text')
          $setSelection(range)
        },
        { discrete: true }
      )
      return getSelectionAsMarkdown(editor, exportParams())
    }

    expect(select(false)).toBe('pha\n\nbra')
    expect(select(true)).toBe('pha\n\nbra')
  })

  it('supports structural NodeSelection and keeps editor-local Markdown options isolated', () => {
    const firstEditor = createSelectionEditor()
    const secondEditor = createSelectionEditor()

    for (const editor of [firstEditor, secondEditor]) {
      editor.update(
        () => {
          const list = $createListNode('bullet').append($createListItemNode().append($createTextNode('item')))
          $getRoot().append(list)
          const selection = $createNodeSelection()
          selection.add(list.getKey())
          $setSelection(selection)
        },
        { discrete: true }
      )
    }

    expect(getSelectionAsMarkdown(firstEditor, exportParams({ toMarkdownOptions: { bullet: '+' } }))).toBe('+ item')
    expect(getSelectionAsMarkdown(secondEditor, exportParams({ toMarkdownOptions: { bullet: '-' } }))).toBe('- item')
  })

  it('inherits consumer node registration, uses its visitor, and does not mutate the source or visitor array', () => {
    const editor = createSelectionEditor()
    let sourceUpdateCount = 0

    editor.update(
      () => {
        const node = new SelectionTestNode('payload')
        $getRoot().append(node)
        const selection = $createNodeSelection()
        selection.add(node.getKey())
        $setSelection(selection)
      },
      { discrete: true }
    )

    const unregister = editor.registerUpdateListener(() => {
      sourceUpdateCount += 1
    })
    const sourceState = editor.getEditorState()
    const sourceSelection = readSelection(editor)
    const prioritizedTextVisitor = { ...LexicalTextVisitor, priority: 100 }
    const visitors = [
      LexicalRootVisitor,
      LexicalParagraphVisitor,
      prioritizedTextVisitor,
      SelectionTestVisitor
    ] as unknown as ExportMarkdownFromLexicalOptions['visitors']
    const originalVisitorOrder = [...visitors]
    const params = exportParams({ visitors })

    expect(getSelectionAsMarkdown(editor, params)).toBe('consumer:payload')
    expect(getSelectionAsMarkdown(editor, params)).toBe('consumer:payload')
    expect(editor.getEditorState()).toBe(sourceState)
    expect(readSelection(editor)).toEqual(sourceSelection)
    expect(sourceUpdateCount).toBe(0)
    expect(visitors).toEqual(originalVisitorOrder)
    unregister()
  })

  it('fails synchronously when selected content has no export visitor', () => {
    const editor = createSelectionEditor()

    editor.update(
      () => {
        const node = new SelectionTestNode('unsupported')
        $getRoot().append(node)
        const selection = $createNodeSelection()
        selection.add(node.getKey())
        $setSelection(selection)
      },
      { discrete: true }
    )

    expect(() => getSelectionAsMarkdown(editor, exportParams())).toThrow('no lexical visitor found for selection-test')
  })

  it('returns empty for a collapsed range', () => {
    const editor = createSelectionEditor()

    editor.update(
      () => {
        const text = $createTextNode('content')
        $getRoot().append($createParagraphNode().append(text))
        text.select(2, 2)
      },
      { discrete: true }
    )

    expect(getSelectionAsMarkdown(editor, exportParams())).toBe('')
  })
})
