import * as Mdast from 'mdast'
import { MdastImportVisitor } from '../../importMarkdownToLexical.js'
import { $createFrontmatterNode } from './FrontmatterNode.js'

export const MdastFrontmatterVisitor: MdastImportVisitor<Mdast.Yaml> = {
  testNode: 'yaml',
  visitNode({ mdastNode, actions }) {
    actions.addAndStepInto($createFrontmatterNode(mdastNode.value))
  }
}
