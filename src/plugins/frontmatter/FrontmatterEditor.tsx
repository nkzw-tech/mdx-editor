import { useCellValue } from '@mdxeditor/gurx'
import React from 'react'
import styles from '../../styles/ui.module.css'
import { readOnly$ } from '../core'

export interface FrontmatterEditorProps {
  yaml: string
  onChange: (yaml: string) => void
}

export const FrontmatterEditor = ({ yaml, onChange }: FrontmatterEditorProps) => {
  const readOnly = useCellValue(readOnly$)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const wrapperRef = React.useRef<HTMLElement>(null)

  const resizeTextarea = React.useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) {
      return
    }

    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [])

  React.useLayoutEffect(() => {
    resizeTextarea()
    const frame = requestAnimationFrame(resizeTextarea)
    return () => cancelAnimationFrame(frame)
  }, [resizeTextarea, yaml])

  React.useEffect(() => {
    const wrapper = wrapperRef.current
    const fonts = document.fonts
    let active = true
    let width = wrapper?.getBoundingClientRect().width
    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(([entry]) => {
            if (entry && entry.contentRect.width !== width) {
              width = entry.contentRect.width
              resizeTextarea()
            }
          })
        : null

    if (wrapper) {
      observer?.observe(wrapper)
    }
    void fonts?.ready.then(() => {
      if (active) {
        resizeTextarea()
      }
    })
    fonts?.addEventListener('loadingdone', resizeTextarea)

    return () => {
      active = false
      observer?.disconnect()
      fonts?.removeEventListener('loadingdone', resizeTextarea)
    }
  }, [resizeTextarea])

  return (
    <section
      className={styles.frontmatterWrapper}
      data-editor-type="frontmatter"
      data-read-only={readOnly}
      ref={wrapperRef}
    >
      <div className={styles.frontmatterLabel}>Frontmatter</div>
      <textarea
        aria-label="Frontmatter YAML"
        className={styles.frontmatterEditor}
        data-autogrow
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => event.stopPropagation()}
        readOnly={readOnly}
        ref={textareaRef}
        rows={1}
        spellCheck={false}
        value={yaml}
      />
    </section>
  )
}
