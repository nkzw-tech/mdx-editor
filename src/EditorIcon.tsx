import React from 'react'
import styles from './styles/ui.module.css'

export type EditorIconName =
  | 'add-column'
  | 'add-row'
  | 'align-center'
  | 'align-left'
  | 'align-right'
  | 'check'
  | 'chevron-down'
  | 'copy'
  | 'delete'
  | 'edit'
  | 'external'
  | 'insert-column-left'
  | 'insert-column-right'
  | 'insert-row-above'
  | 'insert-row-below'
  | 'more'
  | 'unlink'

export const EditorIcon: React.FC<{ className?: string; name: EditorIconName }> = ({ className, name }) => {
  const paths: Record<EditorIconName, React.ReactNode> = {
    'add-column': (
      <>
        <rect x="7" y="3" width="10" height="18" rx="2" />
        <path d="M3 9v6M1 12h4" />
      </>
    ),
    'add-row': (
      <>
        <rect x="3" y="7" width="18" height="10" rx="2" />
        <path d="M9 21h6M12 19v4" />
      </>
    ),
    'align-center': <path d="M4 6h16M7 10h10M4 14h16M7 18h10" />,
    'align-left': <path d="M4 6h16M4 10h10M4 14h16M4 18h10" />,
    'align-right': <path d="M4 6h16M10 10h10M4 14h16M10 18h10" />,
    check: <path d="m5 12 4 4L19 6" />,
    'chevron-down': <path d="m7 9 5 5 5-5" />,
    copy: (
      <>
        <rect width="13" height="13" x="9" y="9" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </>
    ),
    delete: (
      <>
        <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" />
        <path d="M10 11v6M14 11v6" />
      </>
    ),
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
      </>
    ),
    external: (
      <>
        <path d="M15 3h6v6" />
        <path d="m10 14 11-11" />
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      </>
    ),
    'insert-column-left': (
      <>
        <rect x="10" y="4" width="10" height="16" rx="2" />
        <path d="M5 8v8M1 12h8" />
      </>
    ),
    'insert-column-right': (
      <>
        <rect x="4" y="4" width="10" height="16" rx="2" />
        <path d="M19 8v8M15 12h8" />
      </>
    ),
    'insert-row-above': (
      <>
        <rect x="4" y="10" width="16" height="10" rx="2" />
        <path d="M8 5h8M12 1v8" />
      </>
    ),
    'insert-row-below': (
      <>
        <rect x="4" y="4" width="16" height="10" rx="2" />
        <path d="M8 19h8M12 15v8" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
    unlink: (
      <>
        <path d="m18.8 18.8-3.6-3.6" />
        <path d="m8.8 8.8-3.6-3.6" />
        <path d="M9.9 4.2 11 3.1a5 5 0 0 1 7.1 7.1L17 11.3" />
        <path d="m14.1 19.8-1.1 1.1a5 5 0 0 1-7.1-7.1L7 12.7" />
      </>
    )
  }

  return (
    <svg
      aria-hidden="true"
      className={className ? `${styles.editorIcon} ${className}` : styles.editorIcon}
      viewBox="0 0 24 24"
    >
      {paths[name]}
    </svg>
  )
}
