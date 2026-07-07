import { $createQuoteNode } from '@lexical/rich-text'
import * as Mdast from 'mdast'
import { MdastImportVisitor } from '../../importMarkdownToLexical.js'

export const MdastBlockQuoteVisitor: MdastImportVisitor<Mdast.Blockquote> = {
  testNode: 'blockquote',
  visitNode({ actions }) {
    actions.addAndStepInto($createQuoteNode())
  }
}
