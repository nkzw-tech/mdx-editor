import * as Mdast from 'mdast'
import { LexicalExportVisitor } from '../../exportMarkdownFromLexical.js'
import { FrontmatterNode, $isFrontmatterNode } from './FrontmatterNode.js'

export const LexicalFrontmatterVisitor: LexicalExportVisitor<FrontmatterNode, Mdast.Yaml> = {
  testLexicalNode: $isFrontmatterNode,
  visitLexicalNode: ({ actions, lexicalNode }) => {
    actions.addAndStepInto('yaml', { value: lexicalNode.getYaml() })
  }
}
