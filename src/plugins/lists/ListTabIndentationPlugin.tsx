import { ListItemNode } from '@lexical/list'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext.js'
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin.js'
import { $getNearestNodeOfType } from '@lexical/utils'
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  INDENT_CONTENT_COMMAND,
  KEY_TAB_COMMAND,
  OUTDENT_CONTENT_COMMAND
} from 'lexical'
import { useEffect } from 'react'

/**
 * Makes Tab indent list items regardless of the caret's offset within the item.
 * Lexical's generic tab handler only indents when the caret is at the start of
 * a block and otherwise inserts a tab character.
 */
export function ListTabIndentationPlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return editor.registerCommand(
      KEY_TAB_COMMAND,
      (event) => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) {
          return false
        }

        const anchorItem = $getNearestNodeOfType(selection.anchor.getNode(), ListItemNode)
        const focusItem = $getNearestNodeOfType(selection.focus.getNode(), ListItemNode)
        if (!anchorItem || !focusItem) {
          return false
        }

        event.preventDefault()
        return editor.dispatchCommand(event.shiftKey ? OUTDENT_CONTENT_COMMAND : INDENT_CONTENT_COMMAND, undefined)
      },
      COMMAND_PRIORITY_HIGH
    )
  }, [editor])

  return <TabIndentationPlugin />
}
