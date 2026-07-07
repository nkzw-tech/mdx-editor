import { $createHorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode.js'
import * as Mdast from 'mdast'
import { MdastImportVisitor } from '../../importMarkdownToLexical.js'

export const MdastThematicBreakVisitor: MdastImportVisitor<Mdast.ThematicBreak> = {
  testNode: 'thematicBreak',
  visitNode({ actions }) {
    actions.addAndStepInto($createHorizontalRuleNode())
  }
}
