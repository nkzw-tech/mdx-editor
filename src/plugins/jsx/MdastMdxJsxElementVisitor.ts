import { ElementNode } from 'lexical'
import { MdxJsxTextElement } from 'mdast-util-mdx'
import { MdxJsxFlowElement } from 'mdast-util-mdx-jsx'
import { $createLexicalJsxNode } from './LexicalJsxNode.js'
import { MdastImportVisitor } from '../../importMarkdownToLexical.js'

export const MdastMdxJsxElementVisitor: MdastImportVisitor<MdxJsxTextElement | MdxJsxFlowElement> = {
  testNode: (node, { jsxComponentDescriptors }) => {
    if (node.type === 'mdxJsxTextElement' || node.type === 'mdxJsxFlowElement') {
      const descriptor =
        jsxComponentDescriptors.find((descriptor) => descriptor.name === node.name) ??
        jsxComponentDescriptors.find((descriptor) => descriptor.name === '*')
      return descriptor !== undefined
    }
    return false
  },
  visitNode({ lexicalParent, mdastNode, metaData }) {
    ;(lexicalParent as ElementNode).append(
      $createLexicalJsxNode(mdastNode, mdastNode.name ? metaData.importDeclarations[mdastNode.name] : undefined)
    )
  },
  priority: -200,
  jsxKindReconciliationOwner: true
}
