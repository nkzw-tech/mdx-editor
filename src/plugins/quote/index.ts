import { QuoteNode } from '@lexical/rich-text'
import { MdastBlockQuoteVisitor } from './MdastBlockQuoteVisitor.js'
import { LexicalQuoteVisitor } from './LexicalQuoteVisitor.js'
import { realmPlugin } from '../../RealmWithPlugins.js'
import { addActivePlugin$, addImportVisitor$, addLexicalNode$, addExportVisitor$ } from '../core/index.js'

/**
 * A plugin that adds support for block quotes to the editor.
 * @group Quote
 */
export const quotePlugin = realmPlugin({
  init(realm) {
    realm.pubIn({
      [addActivePlugin$]: 'quote',
      [addImportVisitor$]: MdastBlockQuoteVisitor,
      [addLexicalNode$]: QuoteNode,
      [addExportVisitor$]: LexicalQuoteVisitor
    })
  }
})
