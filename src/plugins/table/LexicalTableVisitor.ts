import * as Mdast from 'mdast'
import { TableNode, $isTableNode } from './TableNode.js'
import { LexicalExportVisitor } from '../../exportMarkdownFromLexical.js'

export const LexicalTableVisitor: LexicalExportVisitor<TableNode, Mdast.Table> = {
  testLexicalNode: $isTableNode,
  visitLexicalNode({ actions, mdastParent, lexicalNode }) {
    actions.appendToParent(mdastParent, lexicalNode.getMdastNode())
  }
}
