import { $isRootNode, RootNode as LexicalRootNode } from 'lexical'
import * as Mdast from 'mdast'
import { LexicalExportVisitor } from '../../exportMarkdownFromLexical.js'

export const LexicalRootVisitor: LexicalExportVisitor<LexicalRootNode, Mdast.Root> = {
  testLexicalNode: $isRootNode,
  visitLexicalNode: ({ actions }) => {
    actions.addAndStepInto('root')
  }
}
