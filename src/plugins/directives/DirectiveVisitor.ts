import { LeafDirective } from 'mdast-util-directive'
import { LexicalExportVisitor } from '../../exportMarkdownFromLexical.js'
import { $isDirectiveNode, DirectiveNode } from './DirectiveNode.js'

export const DirectiveVisitor: LexicalExportVisitor<DirectiveNode, LeafDirective> = {
  testLexicalNode: $isDirectiveNode,
  visitLexicalNode({ actions, mdastParent, lexicalNode }) {
    actions.appendToParent(mdastParent, lexicalNode.getMdastNode())
  }
}
