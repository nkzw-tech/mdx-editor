import { $isListItemNode } from '@lexical/list'
import { $createParagraphNode, $createLineBreakNode, type ElementNode } from 'lexical'
import * as Mdast from 'mdast'
import { MdastImportVisitor } from '../../importMarkdownToLexical'

const lexicalTypesThatShouldSkipParagraphs = ['admonition']

export const MdastParagraphVisitor: MdastImportVisitor<Mdast.Paragraph> = {
  testNode: 'paragraph',
  visitNode: function ({ mdastNode, mdastParent, lexicalParent, actions }): void {
    // markdown inserts paragraphs in lists. lexical does not.
    const parentType = lexicalParent.getType()
    const isListItem = $isListItemNode(lexicalParent)

    if (isListItem || lexicalTypesThatShouldSkipParagraphs.includes(parentType)) {
      const mdastNodeIndex = mdastParent?.children.indexOf(mdastNode) ?? -1
      const previousMdastSibling = mdastNodeIndex > 0 ? mdastParent?.children.at(mdastNodeIndex - 1) : undefined

      if (isListItem && previousMdastSibling?.type === 'paragraph') {
        ;(lexicalParent as ElementNode).append($createLineBreakNode(), $createLineBreakNode())
      }
      actions.visitChildren(mdastNode, lexicalParent)
    } else {
      actions.addAndStepInto($createParagraphNode())
    }
  }
}
