import { $createHorizontalRuleNode, $isHorizontalRuleNode, HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode'
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  createEditor,
  KEY_ENTER_COMMAND
} from 'lexical'
import { describe, expect, test } from 'vitest'
import { registerHorizontalRuleOnEnter } from '../horizontalRuleShortcut'

const createTestEditor = (text: string) => {
  const editor = createEditor({
    nodes: [HorizontalRuleNode],
    onError(error) {
      throw error
    }
  })

  editor.update(
    () => {
      const textNode = $createTextNode(text)
      $getRoot().append($createParagraphNode().append(textNode))
      textNode.selectEnd()
    },
    { discrete: true }
  )

  return editor
}

describe('horizontal rule shortcut', () => {
  test('converts a paragraph containing three hyphens on Enter', () => {
    const editor = createTestEditor('---')
    const unregister = registerHorizontalRuleOnEnter(editor)

    expect(editor.dispatchCommand(KEY_ENTER_COMMAND, null)).toBe(true)
    editor.read(() => {
      const children = $getRoot().getChildren()
      expect(children).toHaveLength(2)
      expect($isHorizontalRuleNode(children[0])).toBe(true)
      expect(children[1]?.getTextContent()).toBe('')
    })

    unregister()
  })

  test('leaves other text for the normal Enter handler', () => {
    const editor = createTestEditor('notes---')
    const unregister = registerHorizontalRuleOnEnter(editor)

    expect(editor.dispatchCommand(KEY_ENTER_COMMAND, null)).toBe(false)
    editor.read(() => {
      expect($getRoot().getTextContent()).toBe('notes---')
    })

    unregister()
  })
})

