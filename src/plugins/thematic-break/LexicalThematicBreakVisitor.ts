import { $isHorizontalRuleNode, HorizontalRuleNode } from '@lexical/extension'
import * as Mdast from 'mdast'
import { LexicalExportVisitor } from '../../exportMarkdownFromLexical.js'

export const LexicalThematicBreakVisitor: LexicalExportVisitor<HorizontalRuleNode, Mdast.ThematicBreak> = {
  testLexicalNode: $isHorizontalRuleNode,
  visitLexicalNode({ actions }) {
    actions.addAndStepInto('thematicBreak')
  }
}
