import React from 'react'
import { insertThematicBreak$ } from '../../thematic-break/index.js'
import { ButtonWithTooltip } from '.././primitives/toolbar.js'
import { useCellValue, usePublisher } from '@mdxeditor/gurx'
import { iconComponentFor$, useTranslation } from '../../core/index.js'

/**
 * A toolbar button that allows the user to insert a thematic break (rendered as an HR HTML element).
 * For this button to work, you need to have the `thematicBreakPlugin` plugin enabled.
 * @group Toolbar Components
 */
export const InsertThematicBreak: React.FC = () => {
  const insertThematicBreak = usePublisher(insertThematicBreak$)
  const iconComponentFor = useCellValue(iconComponentFor$)
  const t = useTranslation()
  return (
    <ButtonWithTooltip
      title={t('toolbar.thematicBreak', 'Insert thematic break')}
      onClick={() => {
        insertThematicBreak()
      }}
    >
      {iconComponentFor('horizontal_rule')}
    </ButtonWithTooltip>
  )
}
