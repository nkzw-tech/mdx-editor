import { $isListNode, ListItemNode } from '@lexical/list'
import { $isParagraphNode, type RangeSelection } from 'lexical'

/**
 * Keeps the caret in the empty paragraph created when the first item is
 * removed from a list that still has other items.
 */
export class NotesListItemNode extends ListItemNode {
  $config() {
    return this.config('notes-listitem', { extends: ListItemNode })
  }

  collapseAtStart(selection: RangeSelection): true {
    const list = this.getParent()
    const shouldRestoreSelection = this.isEmpty() && $isListNode(list) && list.getChildrenSize() > 1
    const result = super.collapseAtStart(selection)

    if (shouldRestoreSelection) {
      const paragraph = list.getPreviousSibling()
      if ($isParagraphNode(paragraph)) {
        paragraph.selectStart()
      }
    }

    return result
  }
}
