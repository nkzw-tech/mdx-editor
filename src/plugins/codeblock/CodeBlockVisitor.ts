import * as Mdast from 'mdast'
import { $isCodeBlockNode, CodeBlockNode } from './CodeBlockNode.js'
import { LexicalExportVisitor } from '../../exportMarkdownFromLexical.js'

export const CodeBlockVisitor: LexicalExportVisitor<CodeBlockNode, Mdast.Code> = {
  testLexicalNode: $isCodeBlockNode,
  visitLexicalNode: ({ lexicalNode, actions }) => {
    actions.addAndStepInto('code', {
      value: lexicalNode.getCode(),
      lang: lexicalNode.getLanguage(),
      meta: lexicalNode.getMeta()
    })
  }
}
