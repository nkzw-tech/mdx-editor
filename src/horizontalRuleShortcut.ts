import { $createHorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode'
import {
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isRootOrShadowRoot,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  KEY_ENTER_COMMAND,
  type LexicalEditor
} from 'lexical'
import { createRootEditorSubscription$ } from './plugins/core'
import { realmPlugin } from './RealmWithPlugins'

export const registerHorizontalRuleOnEnter = (editor: LexicalEditor) =>
  editor.registerCommand(
    KEY_ENTER_COMMAND,
    () => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
        return false
      }

      const textNode = selection.anchor.getNode()
      const paragraph = textNode.getParent()
      if (
        !$isTextNode(textNode) ||
        selection.anchor.offset !== 3 ||
        textNode.getTextContent() !== '---' ||
        !$isParagraphNode(paragraph) ||
        paragraph.getChildrenSize() !== 1 ||
        !$isRootOrShadowRoot(paragraph.getParent())
      ) {
        return false
      }

      const horizontalRule = $createHorizontalRuleNode()
      paragraph.clear()
      if (paragraph.getNextSibling()) {
        paragraph.replace(horizontalRule)
      } else {
        paragraph.insertBefore(horizontalRule)
      }
      horizontalRule.selectNext()
      return true
    },
    COMMAND_PRIORITY_HIGH
  )

export const horizontalRuleOnEnterPlugin = realmPlugin({
  init(realm) {
    realm.pub(createRootEditorSubscription$, registerHorizontalRuleOnEnter)
  }
})

