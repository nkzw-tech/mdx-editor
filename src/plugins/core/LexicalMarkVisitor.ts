import { $isMarkNode, type MarkNode } from '@lexical/mark'
import type { LexicalExportVisitor } from '../../exportMarkdownFromLexical.js'

export const LexicalMarkVisitor: LexicalExportVisitor<MarkNode, never> = {
  testLexicalNode: $isMarkNode,
  visitLexicalNode({ lexicalNode, mdastParent, actions }) {
    actions.visitChildren(lexicalNode, mdastParent)
  }
}
