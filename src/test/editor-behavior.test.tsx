import React from 'react'
import { act, render } from '@testing-library/react'
import {
  $addUpdateTag,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $setCompositionKey,
  COMPOSITION_END_TAG,
  createEditor,
  IS_CODE,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  type LexicalEditor,
  UNDO_COMMAND
} from 'lexical'
import { $isListItemNode, $isListNode } from '@lexical/list'
import { describe, expect, test } from 'vitest'
import { MDXEditor, type MDXEditorMethods } from '../MDXEditor'
import { realmPlugin } from '../RealmWithPlugins'
import { rootEditor$ } from '../plugins/core'
import { listsPlugin } from '../plugins/lists'
import { markdownShortcutPlugin } from '../plugins/markdown-shortcut'
import { registerCodeBoundaryEscape } from '../registerCodeBoundaryEscape'

function createCodeEditor(selectionOffset: number): LexicalEditor {
  const editor = createEditor({
    onError(error) {
      throw error
    }
  })

  editor.update(
    () => {
      const text = $createTextNode('test').toggleFormat('code')
      $getRoot().clear().append($createParagraphNode().append(text))
      const selection = text.select(selectionOffset, selectionOffset)
      selection.setFormat(text.getFormat())
    },
    { discrete: true }
  )

  return editor
}

function captureRootEditor(): {
  getEditor: () => LexicalEditor
  plugin: ReturnType<typeof realmPlugin>
} {
  let editor: LexicalEditor | null = null
  return {
    getEditor() {
      if (!editor) {
        throw new Error('Expected MDXEditor to create a root editor')
      }
      return editor
    },
    plugin: realmPlugin({
      postInit(realm) {
        editor = realm.getValue(rootEditor$)
      }
    })
  }
}

function resetToEmptyParagraph(editor: LexicalEditor): void {
  editor.update(
    () => {
      const paragraph = $createParagraphNode()
      $getRoot().clear().append(paragraph)
      paragraph.selectEnd()
    },
    { discrete: true }
  )
}

function typeMarkdown(editor: LexicalEditor, markdown: string): void {
  for (const character of markdown) {
    editor.update(
      () => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) {
          $getRoot().selectEnd()
        }
        $getSelection()?.insertText(character)
      },
      { discrete: true }
    )
  }
  editor.read(() => {})
}

describe('inline code boundary navigation', () => {
  test('ArrowRight exits code at the end and subsequent text stays plain', () => {
    const editor = createCodeEditor(4)
    const unregister = registerCodeBoundaryEscape(editor)

    editor.dispatchCommand(
      KEY_ARROW_RIGHT_COMMAND,
      new KeyboardEvent('keydown', { key: 'ArrowRight' })
    )
    editor.update(
      () => {
        const selection = $getSelection()
        expect($isRangeSelection(selection)).toBe(true)
        if ($isRangeSelection(selection)) {
          expect(selection.format).toBe(0)
          selection.insertText(' asdf')
        }
      },
      { discrete: true }
    )

    editor.read(() => {
      const textNodes = $getRoot().getAllTextNodes()
      expect(textNodes.map((node) => node.getTextContent())).toEqual(['test', ' asdf'])
      expect(textNodes[0]?.hasFormat('code')).toBe(true)
      expect(textNodes[1]?.hasFormat('code')).toBe(false)
    })

    unregister()
  })

  test('ArrowLeft exits code at the beginning', () => {
    const editor = createCodeEditor(0)
    const unregister = registerCodeBoundaryEscape(editor)

    editor.dispatchCommand(
      KEY_ARROW_LEFT_COMMAND,
      new KeyboardEvent('keydown', { key: 'ArrowLeft' })
    )

    editor.read(() => {
      const selection = $getSelection()
      expect($isRangeSelection(selection)).toBe(true)
      if ($isRangeSelection(selection)) {
        expect(selection.format).toBe(0)
        expect(selection.style).toBe('')
      }
    })

    unregister()
  })

  test('does not exit code in the middle or while extending a selection', () => {
    const middleEditor = createCodeEditor(2)
    const unregisterMiddle = registerCodeBoundaryEscape(middleEditor)

    middleEditor.dispatchCommand(
      KEY_ARROW_RIGHT_COMMAND,
      new KeyboardEvent('keydown', { key: 'ArrowRight' })
    )
    middleEditor.read(() => {
      const selection = $getSelection()
      expect($isRangeSelection(selection)).toBe(true)
      if ($isRangeSelection(selection)) {
        expect(selection.format).toBe(IS_CODE)
      }
    })
    unregisterMiddle()

    const endEditor = createCodeEditor(4)
    const unregisterEnd = registerCodeBoundaryEscape(endEditor)
    endEditor.dispatchCommand(
      KEY_ARROW_RIGHT_COMMAND,
      new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true })
    )
    endEditor.read(() => {
      const selection = $getSelection()
      expect($isRangeSelection(selection)).toBe(true)
      if ($isRangeSelection(selection)) {
        expect(selection.format).toBe(IS_CODE)
      }
    })
    unregisterEnd()
  })
})

describe('markdown shortcut editing', () => {
  test('imports asterisk lists at the beginning and end of a document', () => {
    const ref = React.createRef<MDXEditorMethods>()
    render(
      <MDXEditor
        markdown={'* first\n\nmiddle\n\n* last'}
        plugins={[listsPlugin()]}
        ref={ref}
        toMarkdownOptions={{ bullet: '-' }}
      />
    )

    const html = ref.current?.getContentEditableHTML() ?? ''
    expect(html.match(/<ul/g)).toHaveLength(2)
    expect(ref.current?.getMarkdown()).toBe('- first\n\nmiddle\n\n- last')
  })

  test('turns an asterisk shortcut into a list in the first block', () => {
    const capture = captureRootEditor()
    const ref = React.createRef<MDXEditorMethods>()
    render(
      <MDXEditor
        markdown=""
        plugins={[listsPlugin(), markdownShortcutPlugin(), capture.plugin()]}
        ref={ref}
        toMarkdownOptions={{ bullet: '-' }}
      />
    )
    const editor = capture.getEditor()

    act(() => {
      resetToEmptyParagraph(editor)
      typeMarkdown(editor, '* first')
    })

    editor.read(() => {
      expect($isListNode($getRoot().getFirstChild())).toBe(true)
    })
    expect(ref.current?.getMarkdown()).toBe('- first')
  })

  test('converts a closing backtick immediately and emits canonical Markdown', () => {
    const capture = captureRootEditor()
    const ref = React.createRef<MDXEditorMethods>()
    const changes: string[] = []
    render(
      <MDXEditor
        markdown=""
        onChange={(markdown) => changes.push(markdown)}
        plugins={[markdownShortcutPlugin(), capture.plugin()]}
        ref={ref}
      />
    )
    const editor = capture.getEditor()

    act(() => {
      resetToEmptyParagraph(editor)
      typeMarkdown(editor, '`test`')
    })

    editor.read(() => {
      const node = $getRoot().getFirstDescendant()
      expect($isTextNode(node)).toBe(true)
      if ($isTextNode(node)) {
        expect(node.getTextContent()).toBe('test')
        expect(node.hasFormat('code')).toBe(true)
      }
    })
    expect(ref.current?.getMarkdown()).toBe('`test`')
    expect(changes.at(-1)).toBe('`test`')
  })

  test('converts inline code committed by compositionend', () => {
    const capture = captureRootEditor()
    const ref = React.createRef<MDXEditorMethods>()
    render(
      <MDXEditor
        markdown=""
        plugins={[markdownShortcutPlugin(), capture.plugin()]}
        ref={ref}
      />
    )
    const editor = capture.getEditor()

    act(() => {
      editor.update(
        () => {
          const text = $createTextNode('`hello')
          $getRoot().clear().append($createParagraphNode().append(text))
          text.selectEnd()
        },
        { discrete: true }
      )
      editor.update(
        () => {
          const text = $getRoot().getFirstDescendant()
          if (!$isTextNode(text)) {
            throw new Error('Expected text node')
          }
          $setCompositionKey(text.getKey())
          text.setTextContent('`hello`')
          text.select(7, 7)
        },
        { discrete: true }
      )
      editor.update(
        () => {
          const text = $getRoot().getFirstDescendant()
          if (!$isTextNode(text)) {
            throw new Error('Expected text node')
          }
          $setCompositionKey(null)
          $addUpdateTag(COMPOSITION_END_TAG)
          text.markDirty()
        },
        { discrete: true }
      )
      editor.read(() => {})
    })

    editor.read(() => {
      const node = $getRoot().getFirstDescendant()
      expect($isTextNode(node)).toBe(true)
      if ($isTextNode(node)) {
        expect(node.getTextContent()).toBe('hello')
        expect(node.hasFormat('code')).toBe(true)
      }
    })
    expect(ref.current?.getMarkdown()).toBe('`hello`')
  })

  test('undo restores the typed Markdown delimiters after a shortcut transform', () => {
    const capture = captureRootEditor()
    render(
      <MDXEditor
        markdown=""
        plugins={[markdownShortcutPlugin(), capture.plugin()]}
      />
    )
    const editor = capture.getEditor()

    act(() => {
      resetToEmptyParagraph(editor)
      typeMarkdown(editor, 'lorem *ipsum*')
    })
    editor.read(() => {
      expect($getRoot().getTextContent()).toBe('lorem ipsum')
    })

    act(() => {
      editor.dispatchCommand(UNDO_COMMAND, undefined)
      editor.read(() => {})
    })

    editor.read(() => {
      expect($getRoot().getTextContent()).toBe('lorem *ipsum*')
    })
  })

  test('unlisting the first bullet produces a paragraph followed by the remaining list', () => {
    const capture = captureRootEditor()
    const ref = React.createRef<MDXEditorMethods>()
    render(
      <MDXEditor
        markdown={'- first\n- second'}
        plugins={[listsPlugin(), capture.plugin()]}
        ref={ref}
        toMarkdownOptions={{ bullet: '-' }}
      />
    )
    const editor = capture.getEditor()

    act(() => {
      editor.update(
        () => {
          const firstText = $getRoot().getFirstDescendant()
          if (!$isTextNode(firstText)) {
            throw new Error('Expected first list item text')
          }
          const selection = firstText.select(0, 0)
          selection.setFormat(firstText.getFormat())
          const listItem = firstText.getParent()
          if (!$isListItemNode(listItem)) {
            throw new Error('Expected first text node to belong to a list item')
          }
          listItem.collapseAtStart(selection)
        },
        { discrete: true }
      )
      editor.read(() => {})
    })

    expect(ref.current?.getMarkdown()).toBe('first\n\n- second')
  })

  test('keeps the caret in the paragraph created from an empty first bullet', () => {
    const capture = captureRootEditor()
    const ref = React.createRef<MDXEditorMethods>()
    render(
      <MDXEditor
        markdown={'-\n- second'}
        plugins={[listsPlugin(), capture.plugin()]}
        ref={ref}
        toMarkdownOptions={{ bullet: '-' }}
        trim={false}
      />
    )
    const editor = capture.getEditor()

    act(() => {
      editor.update(
        () => {
          const list = $getRoot().getFirstChild()
          if (!$isListNode(list)) {
            throw new Error('Expected a list at the start of the document')
          }
          const listItem = list.getFirstChild()
          if (!$isListItemNode(listItem) || !listItem.isEmpty()) {
            throw new Error('Expected an empty first list item')
          }
          const selection = listItem.selectStart()
          listItem.collapseAtStart(selection)
        },
        { discrete: true }
      )
      editor.read(() => {})
    })

    editor.read(() => {
      const paragraph = $getRoot().getFirstChild()
      const selection = $getSelection()
      expect(paragraph?.getType()).toBe('paragraph')
      expect($isRangeSelection(selection)).toBe(true)
      if ($isRangeSelection(selection) && paragraph) {
        expect(selection.anchor.key).toBe(paragraph.getKey())
        expect(selection.anchor.offset).toBe(0)
        expect(selection.focus.key).toBe(paragraph.getKey())
        expect(selection.focus.offset).toBe(0)
      }
    })
    expect(ref.current?.getMarkdown()).toBe('- second')
  })
})
