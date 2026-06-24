import React, { JSX } from 'react'
import * as RadixSelect from '@radix-ui/react-select'
import classNames from 'classnames'
import { EditorIcon } from '../../../EditorIcon'
import styles from '../../../styles/ui.module.css'
import { TooltipWrap } from './TooltipWrap'
import { editorRootElementRef$, readOnly$ } from '../../core'
import { useCellValue } from '@mdxeditor/gurx'

/**
 * @internal
 */
export const SelectItem = React.forwardRef<HTMLDivElement | null, { className?: string; children: React.ReactNode; value: string }>(
  ({ children, className, ...props }, forwardedRef) => {
    return (
      <RadixSelect.Item {...props} ref={forwardedRef} className={classNames(className, styles.selectItem)}>
        <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
      </RadixSelect.Item>
    )
  }
)

/**
 * @internal
 */
export const SelectTrigger: React.FC<{
  title?: string
  placeholder: string
  className?: string
  showTooltip?: boolean
}> = ({ title, placeholder, className, showTooltip = true }) => {
  const readOnly = useCellValue(readOnly$)
  const trigger = (
    <RadixSelect.Trigger
      aria-label={placeholder}
      className={classNames(styles.selectTrigger, className)}
      data-toolbar-item={true}
      disabled={readOnly}
    >
      <RadixSelect.Value placeholder={placeholder} />
      <RadixSelect.Icon className={styles.selectDropdownArrow}>
        <EditorIcon name="chevron-down" />
      </RadixSelect.Icon>
    </RadixSelect.Trigger>
  )

  return showTooltip && title ? <TooltipWrap title={title}>{trigger}</TooltipWrap> : trigger
}

/**
 * @internal
 */
export const SelectContent: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = styles.selectContainer
}) => {
  const editorRootElementRef = useCellValue(editorRootElementRef$)

  return (
    <RadixSelect.Portal container={editorRootElementRef?.current}>
      <RadixSelect.Content
        className={classNames(className, 'mdxeditor-select-content')}
        onCloseAutoFocus={(e) => {
          e.preventDefault()
        }}
        position="popper"
      >
        <RadixSelect.Viewport data-editor-dropdown={true} style={{ maxHeight: 'var(--radix-select-content-available-height)' }}>
          {children}
        </RadixSelect.Viewport>
      </RadixSelect.Content>
    </RadixSelect.Portal>
  )
}

/**
 * @internal
 */
export const SelectButtonTrigger: React.FC<{ children: React.ReactNode; title: string; className?: string }> = ({
  children,
  title,
  className
}) => {
  const readOnly = useCellValue(readOnly$)
  return (
    <TooltipWrap title={title}>
      <RadixSelect.Trigger aria-label={title} className={classNames(styles.toolbarButtonSelectTrigger, className)} disabled={readOnly}>
        {children}
        <RadixSelect.Icon className={styles.selectDropdownArrow}>
          <EditorIcon name="chevron-down" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
    </TooltipWrap>
  )
}

/**
 * A toolbar primitive you can use to build dropdowns, such as the block type select.
 * @group Toolbar Primitives
 */
export const Select = <T extends string>(props: {
  value: T
  onChange: (value: T) => void
  triggerTitle?: string
  placeholder: string
  disabled?: boolean
  showTooltip?: boolean
  triggerClassName?: string
  contentClassName?: string
  items: ({ label: string | JSX.Element; value: T } | 'separator')[]
}) => {
  return (
    <RadixSelect.Root value={props.value || ''} onValueChange={props.onChange} disabled={props.disabled}>
      <SelectTrigger
        className={props.triggerClassName}
        placeholder={props.placeholder}
        showTooltip={props.showTooltip}
        title={props.triggerTitle}
      />
      <SelectContent className={props.contentClassName}>
        {props.items.map((item, index) => {
          if (item === 'separator') {
            return <RadixSelect.Separator key={index} />
          }
          return (
            <SelectItem key={index} value={item.value}>
              {item.label}
            </SelectItem>
          )
        })}
      </SelectContent>
    </RadixSelect.Root>
  )
}
