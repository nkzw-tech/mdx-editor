import { ButtonWithTooltip } from '.././primitives/toolbar.js'
import React from 'react'
import { insertTable$ } from '../../table/index.js'
import { useCellValue, usePublisher } from '@mdxeditor/gurx'
import { editorInTable$, iconComponentFor$, useTranslation } from '../../core/index.js'

/**
 * A toolbar button that allows the user to insert a table.
 * For this button to work, you need to have the `tablePlugin` plugin enabled.
 * @group Toolbar Components
 */
export const InsertTable: React.FC = () => {
  const iconComponentFor = useCellValue(iconComponentFor$)
  const insertTable = usePublisher(insertTable$)
  const t = useTranslation()

  // Do not allow inserting a table inside a table cell, markdown does not support it
  const isDisabled = useCellValue(editorInTable$)

  return (
    <ButtonWithTooltip
      title={t('toolbar.table', 'Insert Table')}
      onClick={() => {
        insertTable({ rows: 3, columns: 3 })
      }}
      {...(isDisabled ? { 'aria-disabled': true, 'data-disabled': true, disabled: true } : {})}
    >
      {iconComponentFor('table')}
    </ButtonWithTooltip>
  )
}
