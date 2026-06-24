import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react'
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
  type MarkdownEditorProps
} from './MarkdownEditor'

export type MarkdownDocument = {
  content: string
  id: string
  version: string
}

export type MarkdownSaveResult<Document extends MarkdownDocument> =
  | {
      document: Document
      status: 'conflict'
    }
  | {
      document: Document
      status: 'saved'
    }

export type MarkdownPersistenceAdapter<Document extends MarkdownDocument> = {
  save: (input: {
    content: string
    document: Document
    keepalive: boolean
  }) => Promise<MarkdownSaveResult<Document>>
}

export type MarkdownSaveStatus =
  | 'conflict'
  | 'error'
  | 'saved'
  | 'saving'
  | 'unsaved'

export type PersistentMarkdownEditorHandle<Document extends MarkdownDocument> =
  MarkdownEditorHandle & {
    applyExternalChange: (document: Document) => void
    flush: (options?: { keepalive?: boolean }) => Promise<boolean>
    hasUnsavedChanges: () => boolean
  }

export type PersistentMarkdownEditorProps<Document extends MarkdownDocument> =
  Omit<
    MarkdownEditorProps,
    'defaultValue' | 'onBlur' | 'onChange' | 'onError' | 'value'
  > & {
    adapter: MarkdownPersistenceAdapter<Document>
    debounceMs?: number
    document: Document
    fromStorageContent?: (content: string) => string
    lifecycleFlush?: boolean
    maxWaitMs?: number
    onBlur?: MarkdownEditorProps['onBlur']
    onDocumentChange?: (document: Document) => void
    onError?: (error: Error) => void
    onLocalChange?: (content: string) => void
    onStatusChange?: (status: MarkdownSaveStatus) => void
    toStorageContent?: (content: string) => string
  }

type SaveSession<Document extends MarkdownDocument> = {
  conflict: Document | null
  document: Document
  inFlight: Promise<boolean> | null
  inFlightContent: string | null
  latestContent: string
  maxWaitTimer: ReturnType<typeof setTimeout> | null
  savedContent: string
  trailingTimer: ReturnType<typeof setTimeout> | null
}

const defaultFromStorageContent = (content: string) =>
  content.endsWith('\n') ? content.slice(0, -1) : content

const defaultToStorageContent = (content: string) =>
  content.endsWith('\n') ? content : `${content}\n`

const clearTimer = (timer: ReturnType<typeof setTimeout> | null) => {
  if (timer) {
    clearTimeout(timer)
  }
}

function PersistentMarkdownEditorInner<Document extends MarkdownDocument>(
  {
    adapter,
    debounceMs = 50,
    document,
    fromStorageContent = defaultFromStorageContent,
    lifecycleFlush = true,
    maxWaitMs = 250,
    onBlur,
    onDocumentChange,
    onError,
    onLocalChange,
    onStatusChange,
    toStorageContent = defaultToStorageContent,
    ...editorProps
  }: PersistentMarkdownEditorProps<Document>,
  forwardedRef: React.ForwardedRef<PersistentMarkdownEditorHandle<Document>>
) {
  const editorRef = useRef<MarkdownEditorHandle>(null)
  const callbacksRef = useRef({
    adapter,
    fromStorageContent,
    onDocumentChange,
    onError,
    onLocalChange,
    onStatusChange,
    toStorageContent
  })
  callbacksRef.current = {
    adapter,
    fromStorageContent,
    onDocumentChange,
    onError,
    onLocalChange,
    onStatusChange,
    toStorageContent
  }
  const initialContent = fromStorageContent(document.content)
  const [value, setValue] = useState(initialContent)
  const [conflictDocument, setConflictDocument] = useState<Document | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const sessionRef = useRef<SaveSession<Document>>({
    conflict: null,
    document,
    inFlight: null,
    inFlightContent: null,
    latestContent: initialContent,
    maxWaitTimer: null,
    savedContent: initialContent,
    trailingTimer: null
  })

  const setStatus = (status: MarkdownSaveStatus) => {
    callbacksRef.current.onStatusChange?.(status)
  }

  const clearSaveTimers = () => {
    const session = sessionRef.current
    clearTimer(session.trailingTimer)
    clearTimer(session.maxWaitTimer)
    session.trailingTimer = null
    session.maxWaitTimer = null
  }

  const hasUnsavedChanges = () => {
    const session = sessionRef.current
    return (
      session.latestContent !== session.savedContent ||
      session.inFlight !== null
    )
  }

  const saveOnce = async (keepalive: boolean) => {
    const session = sessionRef.current
    if (session.conflict) {
      return false
    }

    const editorContent = session.latestContent
    if (editorContent === session.savedContent) {
      setStatus('saved')
      return true
    }

    setErrorMessage(null)
    setStatus('saving')
    session.inFlightContent = editorContent

    const request = callbacksRef.current.adapter
      .save({
        content: callbacksRef.current.toStorageContent(editorContent),
        document: session.document,
        keepalive
      })
      .then((result) => {
        const storedContent = callbacksRef.current.fromStorageContent(
          result.document.content
        )
        if (
          result.status === 'conflict' &&
          storedContent !== editorContent &&
          storedContent !== session.latestContent &&
          storedContent !== session.savedContent
        ) {
          session.conflict = result.document
          setConflictDocument(result.document)
          setStatus('conflict')
          return false
        }

        session.document = result.document
        session.savedContent =
          result.status === 'saved' ? editorContent : storedContent
        callbacksRef.current.onDocumentChange?.(result.document)
        setStatus(
          session.latestContent === session.savedContent
            ? 'saved'
            : 'unsaved'
        )
        return true
      })
      .catch((error: unknown) => {
        const normalizedError =
          error instanceof Error
            ? error
            : new Error('Failed to save the Markdown document.')
        setErrorMessage(normalizedError.message)
        callbacksRef.current.onError?.(normalizedError)
        setStatus('error')
        return false
      })
      .finally(() => {
        session.inFlight = null
        session.inFlightContent = null
      })

    session.inFlight = request
    return request
  }

  const flush = async ({ keepalive = false } = {}) => {
    clearSaveTimers()
    const session = sessionRef.current

    while (session.latestContent !== session.savedContent) {
      if (session.conflict) {
        return false
      }
      if (session.inFlight) {
        if (!(await session.inFlight)) {
          return false
        }
        continue
      }
      if (!(await saveOnce(keepalive))) {
        return false
      }
    }

    if (session.inFlight) {
      return session.inFlight
    }
    setStatus('saved')
    return true
  }

  const scheduleSave = () => {
    const session = sessionRef.current
    clearTimer(session.trailingTimer)
    session.trailingTimer = setTimeout(() => {
      void flush()
    }, debounceMs)

    if (!session.maxWaitTimer) {
      session.maxWaitTimer = setTimeout(() => {
        void flush()
      }, maxWaitMs)
    }
  }

  const applyExternalChange = (nextDocument: Document) => {
    const session = sessionRef.current
    const diskContent =
      callbacksRef.current.fromStorageContent(nextDocument.content)

    if (nextDocument.version === session.document.version) {
      return
    }

    if (
      diskContent === session.savedContent ||
      diskContent === session.latestContent ||
      diskContent === session.inFlightContent
    ) {
      session.document = nextDocument
      session.savedContent = diskContent
      callbacksRef.current.onDocumentChange?.(nextDocument)
      if (session.latestContent === session.savedContent) {
        clearSaveTimers()
        setStatus('saved')
      } else {
        setStatus(session.inFlight ? 'saving' : 'unsaved')
      }
      return
    }

    if (
      session.latestContent !== session.savedContent ||
      session.inFlight !== null
    ) {
      session.conflict = nextDocument
      setConflictDocument(nextDocument)
      setStatus('conflict')
      return
    }

    clearSaveTimers()
    session.document = nextDocument
    session.latestContent = diskContent
    session.savedContent = diskContent
    callbacksRef.current.onDocumentChange?.(nextDocument)
    setValue(diskContent)
    setStatus('saved')
  }

  useImperativeHandle(
    forwardedRef,
    () => ({
      applyExternalChange,
      flush,
      focus(options) {
        editorRef.current?.focus(options)
      },
      getMarkdown() {
        return editorRef.current?.getMarkdown() ?? sessionRef.current.latestContent
      },
      getSelectionMarkdown() {
        return editorRef.current?.getSelectionMarkdown() ?? ''
      },
      hasUnsavedChanges,
      insertMarkdown(markdown) {
        editorRef.current?.insertMarkdown(markdown)
      },
      setMarkdown(markdown) {
        sessionRef.current.latestContent = markdown
        setValue(markdown)
      }
    })
  )

  useEffect(() => {
    const session = sessionRef.current
    if (document.id !== session.document.id) {
      clearSaveTimers()
      const nextContent = callbacksRef.current.fromStorageContent(document.content)
      session.conflict = null
      session.document = document
      session.inFlight = null
      session.inFlightContent = null
      session.latestContent = nextContent
      session.savedContent = nextContent
      setConflictDocument(null)
      setErrorMessage(null)
      setValue(nextContent)
      setStatus('saved')
    } else if (document.version !== session.document.version) {
      applyExternalChange(document)
    }
  }, [document])

  useEffect(() => {
    setStatus('saved')
    if (!lifecycleFlush || typeof window === 'undefined') {
      return () => clearSaveTimers()
    }

    const onVisibilityChange = () => {
      if (globalThis.document.visibilityState === 'hidden' && hasUnsavedChanges()) {
        void flush({ keepalive: true })
      }
    }
    const onPageHide = () => {
      if (hasUnsavedChanges()) {
        void flush({ keepalive: true })
      }
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges()) {
        return
      }
      void flush({ keepalive: true })
      event.preventDefault()
      event.returnValue = ''
    }

    globalThis.document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      globalThis.document.removeEventListener(
        'visibilitychange',
        onVisibilityChange
      )
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('pagehide', onPageHide)
      clearSaveTimers()
    }
  }, [lifecycleFlush])

  const handleChange = (markdown: string) => {
    const session = sessionRef.current
    session.latestContent = markdown
    setValue(markdown)
    callbacksRef.current.onLocalChange?.(markdown)

    if (markdown === session.savedContent) {
      clearSaveTimers()
      setStatus('saved')
      return
    }

    setStatus('unsaved')
    scheduleSave()
  }

  const useDiskVersion = () => {
    const remote = conflictDocument
    if (!remote) {
      return
    }
    const session = sessionRef.current
    const remoteContent = callbacksRef.current.fromStorageContent(remote.content)
    clearSaveTimers()
    session.conflict = null
    session.document = remote
    session.latestContent = remoteContent
    session.savedContent = remoteContent
    setConflictDocument(null)
    setErrorMessage(null)
    callbacksRef.current.onDocumentChange?.(remote)
    setValue(remoteContent)
    setStatus('saved')
  }

  const keepMyVersion = () => {
    const remote = conflictDocument
    if (!remote) {
      return
    }
    const session = sessionRef.current
    session.conflict = null
    session.document = remote
    session.savedContent = callbacksRef.current.fromStorageContent(remote.content)
    setConflictDocument(null)
    setErrorMessage(null)
    setStatus('unsaved')
    void flush()
  }

  return (
    <div
      className={[
        'mdx-editor-persistent',
        editorProps.className
      ].filter(Boolean).join(' ')}
    >
      {conflictDocument ? (
        <div className="mdx-editor-notice" data-kind="conflict" role="alert">
          <span>The file on disk changed while you were editing.</span>
          <div>
            <button onClick={useDiskVersion} type="button">
              Use disk version
            </button>
            <button onClick={keepMyVersion} type="button">
              Keep my version
            </button>
          </div>
        </div>
      ) : null}
      {errorMessage ? (
        <div className="mdx-editor-notice" data-kind="error" role="alert">
          <span>{errorMessage}</span>
          <button onClick={() => void flush()} type="button">
            Retry
          </button>
        </div>
      ) : null}
      <MarkdownEditor
        {...editorProps}
        onBlur={(event) => {
          onBlur?.(event)
          void flush()
        }}
        onChange={handleChange}
        onError={(error) => {
          setErrorMessage(error.message)
          callbacksRef.current.onError?.(error)
          setStatus('error')
        }}
        ref={editorRef}
        value={value}
      />
    </div>
  )
}

export const PersistentMarkdownEditor = forwardRef(
  PersistentMarkdownEditorInner
) as <Document extends MarkdownDocument>(
  props: PersistentMarkdownEditorProps<Document> & {
    ref?: React.ForwardedRef<PersistentMarkdownEditorHandle<Document>>
  }
) => React.ReactElement

export default PersistentMarkdownEditor
