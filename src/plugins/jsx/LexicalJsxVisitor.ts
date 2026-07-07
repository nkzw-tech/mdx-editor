import { MdxJsxFlowElement, MdxJsxTextElement } from 'mdast-util-mdx-jsx'
import { $isLexicalJsxNode, LexicalJsxNode } from './LexicalJsxNode.js'
import { LexicalExportVisitor } from '../../exportMarkdownFromLexical.js'
import * as Mdast from 'mdast'
import { isMdastJsxNode } from './index.js'
import { isHtmlTagName } from './jsxTagName.js'

export const LexicalJsxVisitor: LexicalExportVisitor<LexicalJsxNode, MdxJsxFlowElement | MdxJsxTextElement> = {
  testLexicalNode: $isLexicalJsxNode,
  visitLexicalNode({ actions, mdastParent, lexicalNode }) {
    function traverseNestedJsxNodes(node: Mdast.Nodes) {
      if ('children' in node && node.children instanceof Array) {
        node.children.forEach((child: Mdast.Nodes) => {
          if (isMdastJsxNode(child) && !isHtmlTagName(child.name!)) {
            actions.registerReferredComponent(child.name!)
          }
          traverseNestedJsxNodes(child)
        })
      }
    }

    const mdastNode = lexicalNode.getMdastNode()
    const importStatement = lexicalNode.getImportStatement()
    actions.registerReferredComponent(mdastNode.name!, importStatement)
    traverseNestedJsxNodes(mdastNode)
    actions.appendToParent(mdastParent, mdastNode)
  },
  priority: -200
}
