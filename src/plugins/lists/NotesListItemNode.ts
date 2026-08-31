import { $isListItemNode, $isListNode, ListItemNode } from '@lexical/list'
import type { RangeSelection } from 'lexical'

/**
 * Removes an empty list item into the preceding item when there is one.
 * Lexical handles first and nested items itself so they can still be
 * converted to a paragraph or outdented, respectively.
 */
export class NotesListItemNode extends ListItemNode {
  $config() {
    return this.config('notes-listitem', { extends: ListItemNode })
  }

  collapseAtStart(selection: RangeSelection): boolean {
    const list = this.getParent()
    const previousItem = this.getPreviousSibling()

    if (
      this.isEmpty() &&
      $isListNode(list) &&
      !$isListItemNode(list.getParent()) &&
      $isListItemNode(previousItem)
    ) {
      this.remove()
      previousItem.selectEnd()
      return true
    }

    return super.collapseAtStart(selection)
  }
}
