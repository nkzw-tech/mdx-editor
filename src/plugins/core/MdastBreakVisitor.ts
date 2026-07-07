import { $createLineBreakNode, ElementNode } from 'lexical'
import * as Mdast from 'mdast'
import { MdastImportVisitor } from '../../importMarkdownToLexical.js'

export const MdastBreakVisitor: MdastImportVisitor<Mdast.Paragraph> = {
  testNode: 'break',
  visitNode: function ({ lexicalParent }): void {
    ;(lexicalParent as ElementNode).append($createLineBreakNode())
  }
}
