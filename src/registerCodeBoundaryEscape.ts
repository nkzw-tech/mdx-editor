import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  type LexicalEditor
} from 'lexical'
import { mergeRegister } from '@lexical/utils'

function escapeCodeFormatAtBoundary(direction: 'start' | 'end', shiftKey: boolean): boolean {
  if (shiftKey) {
    return false
  }

  const selection = $getSelection()
  if (!$isRangeSelection(selection) || !selection.isCollapsed() || selection.anchor.type !== 'text') {
    return false
  }

  const node = selection.anchor.getNode()
  if (!$isTextNode(node) || !node.hasFormat('code') || !selection.hasFormat('code')) {
    return false
  }

  const offset = selection.anchor.offset
  const isBoundary =
    direction === 'start'
      ? offset === 0 && node.getPreviousSibling() === null
      : offset === node.getTextContentSize() && node.getNextSibling() === null

  if (!isBoundary) {
    return false
  }

  selection.toggleFormat('code')
  selection.setStyle('')
  return false
}

/**
 * Makes arrow navigation leave inline-code formatting at either edge.
 *
 * Lexical 0.45 supports this through RichTextExtension configuration, but
 * MDXEditor still uses Lexical's legacy RichTextPlugin. Registering the
 * boundary commands separately gives the legacy integration the same
 * behavior without replacing or duplicating the rest of rich-text handling.
 */
export function registerCodeBoundaryEscape(editor: LexicalEditor): () => void {
  return mergeRegister(
    editor.registerCommand(
      KEY_ARROW_LEFT_COMMAND,
      (event) => escapeCodeFormatAtBoundary('start', event.shiftKey),
      COMMAND_PRIORITY_HIGH
    ),
    editor.registerCommand(
      KEY_ARROW_RIGHT_COMMAND,
      (event) => escapeCodeFormatAtBoundary('end', event.shiftKey),
      COMMAND_PRIORITY_HIGH
    )
  )
}
