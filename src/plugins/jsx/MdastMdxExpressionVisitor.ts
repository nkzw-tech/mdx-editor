import { ElementNode } from 'lexical'
import { MdxFlowExpression, MdxTextExpression } from 'mdast-util-mdx'
import { MdastImportVisitor } from '../../importMarkdownToLexical.js'
import { $createLexicalMdxExpressionNode } from './LexicalMdxExpressionNode.js'

export const MdastMdxExpressionVisitor: MdastImportVisitor<MdxTextExpression | MdxFlowExpression> = {
  testNode: (node) => node.type === 'mdxTextExpression' || node.type === 'mdxFlowExpression',
  visitNode({ lexicalParent, mdastNode }) {
    ;(lexicalParent as ElementNode).append($createLexicalMdxExpressionNode(mdastNode.value, mdastNode.type))
  },
  priority: -200
}
