import { ElementNode } from 'lexical'
import * as Mdast from 'mdast'
import { MdastImportVisitor } from '../../importMarkdownToLexical.js'
import { $createTableNode } from './TableNode.js'

export const MdastTableVisitor: MdastImportVisitor<Mdast.Table> = {
  testNode: 'table',
  visitNode({ mdastNode, lexicalParent }) {
    ;(lexicalParent as ElementNode).append($createTableNode(mdastNode))
  }
}
