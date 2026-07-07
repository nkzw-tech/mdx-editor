import { $isLineBreakNode, LineBreakNode } from 'lexical'
import * as Mdast from 'mdast'
import { LexicalExportVisitor } from '../../exportMarkdownFromLexical.js'

export const LexicalLinebreakVisitor: LexicalExportVisitor<LineBreakNode, Mdast.Text> = {
  testLexicalNode: $isLineBreakNode,
  visitLexicalNode: ({ mdastParent, actions }) => {
    actions.appendToParent(mdastParent, { type: 'text', value: '\n' })
  }
}
