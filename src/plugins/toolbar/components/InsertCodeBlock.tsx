import React from 'react'
import { ButtonWithTooltip } from '.././primitives/toolbar.js'
import { insertCodeBlock$ } from '../../codeblock//index.js'
import { useCellValue, usePublisher } from '@mdxeditor/gurx'
import { iconComponentFor$, useTranslation } from '../../core/index.js'

/**
 * A toolbar button that allows the user to insert a fenced code block.
 * Once the code block is focused, you can construct a special code block toolbar for it, using the {@link ConditionalContents} primitive.
 * See the {@link ConditionalContents} documentation for an example.
 *
 * @group Toolbar Components
 */
export const InsertCodeBlock: React.FC = () => {
  const insertCodeBlock = usePublisher(insertCodeBlock$)
  const iconComponentFor = useCellValue(iconComponentFor$)
  const t = useTranslation()
  return (
    <ButtonWithTooltip
      title={t('toolbar.codeBlock', 'Insert Code Block')}
      onClick={() => {
        insertCodeBlock({})
      }}
    >
      {iconComponentFor('frame_source')}
    </ButtonWithTooltip>
  )
}
