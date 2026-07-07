import type { MdxJsxAttribute } from 'mdast-util-mdx'
import { MdastImportVisitor } from '../../importMarkdownToLexical.js'
import { $createGenericHTMLNode } from './GenericHTMLNode.js'
import { isMdastHTMLNode, MdastHTMLNode } from './MdastHTMLNode.js'

export const MdastHTMLVisitor: MdastImportVisitor<MdastHTMLNode> = {
  testNode: isMdastHTMLNode,
  visitNode: function ({ mdastNode, actions, lexicalParent }): void {
    // style only span - we will just use it as a style carrier.
    if (
      mdastNode.name === 'span' &&
      mdastNode.attributes.length === 1 &&
      mdastNode.attributes[0].type === 'mdxJsxAttribute' &&
      mdastNode.attributes[0].name === 'style'
    ) {
      actions.addStyle(mdastNode.attributes[0].value as string, mdastNode)
      actions.visitChildren(mdastNode, lexicalParent)
    } else {
      actions.addAndStepInto($createGenericHTMLNode(mdastNode.name, mdastNode.type, mdastNode.attributes as MdxJsxAttribute[]))
    }
  },
  priority: -100
}
