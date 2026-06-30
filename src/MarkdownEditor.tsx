import type {
  FocusEvent as ReactFocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode
} from 'react'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import type { ToMarkdownOptions } from './exportMarkdownFromLexical'
import type {
  MarkdownAnnotation,
  MarkdownAnnotationAnchor,
  MarkdownAnnotationLayout,
  MarkdownCommentTarget
} from './annotations'
import { horizontalRuleOnEnterPlugin } from './horizontalRuleShortcut'
import {
  MDXEditor,
  type MDXEditorMethods
} from './MDXEditor'
import { codeBlockPlugin } from './plugins/codeblock'
import { codeMirrorPlugin } from './plugins/codemirror'
import { headingsPlugin } from './plugins/headings'
import { imagePlugin } from './plugins/image'
import { linkDialogPlugin } from './plugins/link-dialog'
import { linkPlugin } from './plugins/link'
import { listsPlugin } from './plugins/lists'
import { markdownShortcutPlugin } from './plugins/markdown-shortcut'
import { quotePlugin } from './plugins/quote'
import { tablePlugin } from './plugins/table'
import { thematicBreakPlugin } from './plugins/thematic-break'
import type { RealmPlugin } from './RealmWithPlugins'

const canonicalMarkdownOptions: ToMarkdownOptions = {
  bullet: '-',
  emphasis: '*',
  fences: true,
  listItemIndent: 'one',
  rule: '-',
  strong: '*'
}

const emptyPlugins: RealmPlugin[] = []

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ')

const imageWithAttributePattern =
  /!\[([^\]\n]*(?:\\.[^\]\n]*)*)\]\(([^)\n]+)\)\{([^}\n]+)\}/g
const imageAttributePattern =
  /(?:^|\s)(width|height)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s}]+))/gi

const escapeHtmlAttribute = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

const parseImageDestination = (value: string) => {
  const trimmed = value.trim()
  if (trimmed.startsWith('<')) {
    const end = trimmed.indexOf('>')
    return end > 0
      ? {
          src: trimmed.slice(1, end),
          title: trimmed.slice(end + 1).trim() || undefined
        }
      : { src: trimmed }
  }

  const match = /^(\S+)(?:\s+("([^"]*)"|'([^']*)'))?\s*$/.exec(trimmed)
  return {
    src: match?.[1] ?? trimmed,
    title: match?.[3] ?? match?.[4]
  }
}

const normalizeMarkdownImageAttributes = (markdown: string) =>
  markdown.replaceAll(
    imageWithAttributePattern,
    (match, altText: string, destination: string, attributes: string) => {
      const dimensions: Record<'height' | 'width', string | undefined> = {
        height: undefined,
        width: undefined
      }
      let attributeMatch: RegExpExecArray | null
      imageAttributePattern.lastIndex = 0
      while ((attributeMatch = imageAttributePattern.exec(attributes))) {
        const key = attributeMatch[1]?.toLowerCase()
        if (key === 'height' || key === 'width') {
          dimensions[key] =
            attributeMatch[2] ?? attributeMatch[3] ?? attributeMatch[4]
        }
      }
      if (!dimensions.height && !dimensions.width) {
        return match
      }

      const { src, title } = parseImageDestination(destination)
      const htmlAttributes = [
        `src="${escapeHtmlAttribute(src)}"`,
        `alt="${escapeHtmlAttribute(altText.replaceAll('\\]', ']'))}"`,
        title ? `title="${escapeHtmlAttribute(title)}"` : null,
        dimensions.width ? `width="${escapeHtmlAttribute(dimensions.width)}"` : null,
        dimensions.height
          ? `height="${escapeHtmlAttribute(dimensions.height)}"`
          : null
      ].filter(Boolean)
      return `<img ${htmlAttributes.join(' ')} />`
    }
  )

export type MarkdownEditorColorScheme = 'dark' | 'inherit' | 'light' | 'system'
export type MarkdownEditorDensity = 'compact' | 'document'
export type MarkdownEditorVariant = 'card' | 'embedded' | 'plain'

export type MarkdownEditorHandle = {
  createAnnotation: (
    id: string,
    target?: MarkdownCommentTarget | null
  ) => MarkdownAnnotationAnchor | null
  focus: (options?: {
    defaultSelection?: 'rootStart' | 'rootEnd'
    preventScroll?: boolean
  }) => void
  focusAnnotation: (id: string) => void
  getAnnotationAnchor: (id: string) => MarkdownAnnotationAnchor | null
  getMarkdown: () => string
  getSelectionMarkdown: () => string
  insertMarkdown: (markdown: string) => void
  removeAnnotation: (id: string) => void
  setMarkdown: (markdown: string) => void
}

export type MarkdownEditorProps = {
  activeAnnotationId?: string | null
  additionalPlugins?: RealmPlugin[]
  annotations?: readonly MarkdownAnnotation[]
  ariaLabel?: string
  autoFocus?: boolean | {
    defaultSelection?: 'rootStart' | 'rootEnd'
    preventScroll?: boolean
  }
  className?: string
  colorScheme?: MarkdownEditorColorScheme
  contentClassName?: string
  defaultValue?: string
  density?: MarkdownEditorDensity
  minHeight?: number | string
  onAnnotationAnchorChange?: (
    id: string,
    anchor: MarkdownAnnotationAnchor | null
  ) => void
  onAnnotationLayoutChange?: (
    layouts: readonly MarkdownAnnotationLayout[]
  ) => void
  onBlur?: (event: FocusEvent) => void
  onChange?: (markdown: string) => void
  onCommentTargetChange?: (target: MarkdownCommentTarget | null) => void
  onError?: (error: Error) => void
  onFocus?: (event: ReactFocusEvent<HTMLDivElement>) => void
  onHeightChange?: (height: number) => void
  onKeyDown?: (event: ReactKeyboardEvent<HTMLDivElement>) => void
  onNavigate?: (target: string) => void
  onOpenExternalLink?: (href: string) => void
  overlayContainer?: HTMLElement | null
  placeholder?: ReactNode
  readOnly?: boolean
  resolveLink?: (href: string) => string | null
  spellCheck?: boolean
  suppressHtmlProcessing?: boolean
  toMarkdownOptions?: ToMarkdownOptions
  value?: string
  variant?: MarkdownEditorVariant
}

const getSystemColorScheme = () => {
  if (typeof window === 'undefined') {
    return 'light' as const
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

const getInheritedColorScheme = () => {
  if (typeof document === 'undefined') {
    return 'light' as const
  }
  const configuredTheme = document.documentElement.dataset.theme
  return configuredTheme === 'dark' || configuredTheme === 'light'
    ? configuredTheme
    : getSystemColorScheme()
}

const useResolvedColorScheme = (colorScheme: MarkdownEditorColorScheme) => {
  const getResolved = () =>
    colorScheme === 'system'
      ? getSystemColorScheme()
      : colorScheme === 'inherit'
        ? getInheritedColorScheme()
        : colorScheme
  const [resolved, setResolved] = useState<'dark' | 'light'>(getResolved)

  useEffect(() => {
    setResolved(getResolved())
  }, [colorScheme])

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      (colorScheme !== 'system' && colorScheme !== 'inherit')
    ) {
      return
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setResolved(getResolved())
    const observer =
      colorScheme === 'inherit' && typeof MutationObserver !== 'undefined'
        ? new MutationObserver(update)
        : null

    media.addEventListener('change', update)
    observer?.observe(document.documentElement, {
      attributeFilter: ['data-theme'],
      attributes: true
    })
    return () => {
      media.removeEventListener('change', update)
      observer?.disconnect()
    }
  }, [colorScheme])

  return resolved
}

const openHref = (
  href: string,
  {
    onNavigate,
    onOpenExternalLink,
    resolveLink
  }: {
    onNavigate?: (target: string) => void
    onOpenExternalLink?: (href: string) => void
    resolveLink?: (href: string) => string | null
  }
) => {
  const resolved = resolveLink?.(href)
  if (resolved) {
    onNavigate?.(resolved)
    return
  }
  if (!/^https?:\/\//.test(href)) {
    return
  }
  if (onOpenExternalLink) {
    onOpenExternalLink(href)
  } else if (typeof window !== 'undefined') {
    window.open(href, '_blank', 'noopener,noreferrer')
  }
}

const createDefaultPlugins = (
  onClickLink: (href: string) => void,
  readOnly: boolean
) => [
  headingsPlugin(),
  listsPlugin(),
  quotePlugin(),
  ...(readOnly ? [imagePlugin()] : []),
  linkPlugin(),
  linkDialogPlugin({
    onClickLinkCallback: onClickLink
  }),
  tablePlugin(),
  thematicBreakPlugin(),
  codeBlockPlugin({
    defaultCodeBlockLanguage: 'txt'
  }),
  codeMirrorPlugin({
    autoLoadLanguageSupport: false,
    codeBlockLanguages: {
      css: 'CSS',
      html: 'HTML',
      js: 'JavaScript',
      json: 'JSON',
      jsx: 'JSX',
      md: 'Markdown',
      sh: 'Shell',
      ts: 'TypeScript',
      tsx: 'TSX',
      txt: 'Plain text'
    }
  }),
  markdownShortcutPlugin(),
  horizontalRuleOnEnterPlugin()
]

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor(
    {
      activeAnnotationId,
      additionalPlugins = emptyPlugins,
      annotations = [],
      ariaLabel,
      autoFocus = false,
      className,
      colorScheme = 'system',
      contentClassName,
      defaultValue = '',
      density = 'document',
      minHeight,
      onAnnotationAnchorChange,
      onAnnotationLayoutChange,
      onBlur,
      onChange,
      onCommentTargetChange,
      onError,
      onFocus,
      onHeightChange,
      onKeyDown,
      onNavigate,
      onOpenExternalLink,
      overlayContainer,
      placeholder,
      readOnly = false,
      resolveLink,
      spellCheck = true,
      suppressHtmlProcessing = false,
      toMarkdownOptions = canonicalMarkdownOptions,
      value,
      variant = 'card'
    },
    forwardedRef
  ) {
    const initialMarkdownRef = useRef(
      normalizeMarkdownImageAttributes(value ?? defaultValue)
    )
    const currentMarkdownRef = useRef(initialMarkdownRef.current)
    const editorRef = useRef<MDXEditorMethods>(null)
    const shellRef = useRef<HTMLDivElement>(null)
    const handlersRef = useRef({
      onNavigate,
      onOpenExternalLink,
      resolveLink
    })
    handlersRef.current = { onNavigate, onOpenExternalLink, resolveLink }
    const resolvedColorScheme = useResolvedColorScheme(colorScheme)

    const plugins = useMemo(
      () => [
        ...createDefaultPlugins(
          (href) => openHref(href, handlersRef.current),
          readOnly
        ),
        ...additionalPlugins
      ],
      [additionalPlugins, readOnly]
    )

    useEffect(() => {
      if (value === undefined) {
        return
      }
      const normalizedValue = normalizeMarkdownImageAttributes(value)
      if (normalizedValue === currentMarkdownRef.current) {
        return
      }
      currentMarkdownRef.current = normalizedValue
      editorRef.current?.setMarkdown(normalizedValue)
    }, [value])

    useEffect(() => {
      const contentEditable = shellRef.current?.querySelector<HTMLElement>(
        '.mdx-editor-content[contenteditable]'
      )
      if (contentEditable && ariaLabel) {
        contentEditable.setAttribute('aria-label', ariaLabel)
      }
    }, [ariaLabel])

    useEffect(() => {
      const element = shellRef.current
      if (!element || !onHeightChange || typeof ResizeObserver === 'undefined') {
        return
      }
      let previousHeight = -1
      const observer = new ResizeObserver(([entry]) => {
        const height =
          entry?.borderBoxSize[0]?.blockSize ?? entry?.contentRect.height
        if (height !== undefined && height !== previousHeight) {
          previousHeight = height
          onHeightChange(height)
        }
      })
      observer.observe(element)
      return () => observer.disconnect()
    }, [onHeightChange])

    useImperativeHandle(
      forwardedRef,
      () => ({
        createAnnotation(id, target) {
          return editorRef.current?.createAnnotation(id, target) ?? null
        },
        focus(options) {
          editorRef.current?.focus(undefined, options)
        },
        focusAnnotation(id) {
          editorRef.current?.focusAnnotation(id)
        },
        getAnnotationAnchor(id) {
          return editorRef.current?.getAnnotationAnchor(id) ?? null
        },
        getMarkdown() {
          return editorRef.current?.getMarkdown() ?? currentMarkdownRef.current
        },
        getSelectionMarkdown() {
          return editorRef.current?.getSelectionMarkdown() ?? ''
        },
        insertMarkdown(markdown) {
          editorRef.current?.insertMarkdown(
            normalizeMarkdownImageAttributes(markdown)
          )
        },
        removeAnnotation(id) {
          editorRef.current?.removeAnnotation(id)
        },
        setMarkdown(markdown) {
          const normalizedMarkdown = normalizeMarkdownImageAttributes(markdown)
          currentMarkdownRef.current = normalizedMarkdown
          editorRef.current?.setMarkdown(normalizedMarkdown)
        }
      }),
      []
    )

    const handleChange = (markdown: string, initialMarkdownNormalize: boolean) => {
      currentMarkdownRef.current = markdown
      if (!initialMarkdownNormalize) {
        onChange?.(markdown)
      }
    }

    const handleLinkClick = (event: ReactMouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement
      const anchor = target.closest('a')
      if (!anchor?.closest('.mdx-editor-content')) {
        return
      }
      event.preventDefault()
      if (!event.metaKey && !event.ctrlKey) {
        return
      }
      const href = anchor.getAttribute('href')
      if (href) {
        openHref(href, handlersRef.current)
      }
    }

    const rootClassName = cx(
      'mdx-editor',
      `mdx-editor-${density}`,
      `mdx-editor-${variant}`,
      resolvedColorScheme === 'dark' && 'dark-theme',
      className
    )

    return (
      <div
        className={cx('mdx-editor-shell', className)}
        data-color-scheme={resolvedColorScheme}
        data-density={density}
        data-read-only={readOnly ? 'true' : undefined}
        data-variant={variant}
        onClickCapture={handleLinkClick}
        onFocusCapture={onFocus}
        onKeyDownCapture={onKeyDown}
        ref={shellRef}
        style={minHeight === undefined ? undefined : { minHeight }}
      >
        <MDXEditor
          activeAnnotationId={activeAnnotationId}
          annotations={annotations}
          autoFocus={autoFocus}
          className={rootClassName}
          contentEditableClassName={cx(
            'mdx-editor-content',
            contentClassName
          )}
          markdown={initialMarkdownRef.current}
          onAnnotationAnchorChange={onAnnotationAnchorChange}
          onAnnotationLayoutChange={onAnnotationLayoutChange}
          onBlur={onBlur}
          onChange={handleChange}
          onCommentTargetChange={onCommentTargetChange}
          onError={({ error }) => onError?.(new Error(error))}
          overlayContainer={overlayContainer}
          placeholder={placeholder}
          plugins={plugins}
          readOnly={readOnly}
          ref={editorRef}
          spellCheck={spellCheck}
          suppressHtmlProcessing={suppressHtmlProcessing}
          toMarkdownOptions={toMarkdownOptions}
          trim={false}
        />
      </div>
    )
  }
)

export default MarkdownEditor
