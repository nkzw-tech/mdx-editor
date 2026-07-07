import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import React from 'react'
import { historyState$ } from './index.js'
import { useCellValue } from '@mdxeditor/gurx'

export const SharedHistoryPlugin = () => {
  return <HistoryPlugin externalHistoryState={useCellValue(historyState$)} />
}
