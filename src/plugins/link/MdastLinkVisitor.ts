import { $createLinkNode } from '@lexical/link'
import * as Mdast from 'mdast'
import { MdastImportVisitor } from '../../importMarkdownToLexical.js'

export const MdastLinkVisitor: MdastImportVisitor<Mdast.Link> = {
  testNode: 'link',
  visitNode({ mdastNode, actions }) {
    actions.addAndStepInto(
      $createLinkNode(mdastNode.url, {
        title: mdastNode.title
      })
    )
  }
}
