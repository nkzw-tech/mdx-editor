import { act, createRef } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  PersistentMarkdownEditor,
  type PersistentMarkdownEditorHandle
} from '../PersistentMarkdownEditor'
import type { MarkdownEditorProps } from '../MarkdownEditor'

type TestDocument = {
  content: string
  id: string
  path: string
  version: string
}

const editorMock = vi.hoisted(() => ({
  props: null as MarkdownEditorProps | null
}))

vi.mock('../MarkdownEditor', async () => {
  const ReactModule = await import('react')
  return {
    MarkdownEditor: ReactModule.forwardRef<
      {
        focus: () => void
        getMarkdown: () => string
        getSelectionMarkdown: () => string
        insertMarkdown: () => void
        setMarkdown: () => void
      },
      MarkdownEditorProps
    >((props, ref) => {
      editorMock.props = props
      ReactModule.useImperativeHandle(ref, () => ({
        focus: () => undefined,
        getMarkdown: () => props.value ?? '',
        getSelectionMarkdown: () => '',
        insertMarkdown: () => undefined,
        setMarkdown: () => undefined
      }))
      return ReactModule.createElement('div', {
        'data-value': props.value
      })
    })
  }
})

const initialDocument: TestDocument = {
  content: '',
  id: 'docs/test.md',
  path: 'docs/test.md',
  version: 'initial-version'
}

const deferred = <Value,>() => {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

const renderPersistentEditor = async (
  documentToRender: TestDocument = initialDocument
) => {
  const container = document.createElement('div')
  const root = createRoot(container)
  const ref = createRef<PersistentMarkdownEditorHandle<TestDocument>>()
  const adapter = {
    save: vi.fn()
  }
  const onDocumentChange = vi.fn()
  const onLocalChange = vi.fn()
  const onStatusChange = vi.fn()

  await act(async () => {
    root.render(
      <PersistentMarkdownEditor
        adapter={adapter}
        document={documentToRender}
        lifecycleFlush={false}
        onDocumentChange={onDocumentChange}
        onLocalChange={onLocalChange}
        onStatusChange={onStatusChange}
        ref={ref}
      />
    )
  })

  const props = editorMock.props
  if (!props) {
    throw new Error('Expected mocked MarkdownEditor props')
  }

  return {
    adapter,
    container,
    onDocumentChange,
    onLocalChange,
    onStatusChange,
    props,
    ref,
    root
  }
}

describe('PersistentMarkdownEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    editorMock.props = null
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('debounces changes and saves canonical storage content', async () => {
    const storedDocument: TestDocument = {
      content: '`test`\n',
      id: 'docs/test.md',
      path: 'docs/test.md',
      version: 'saved-version'
    }
    const rendered = await renderPersistentEditor()
    rendered.adapter.save.mockResolvedValue({
      document: storedDocument,
      status: 'saved'
    })

    act(() => {
      rendered.props.onChange?.('\\`test\\`')
      rendered.props.onChange?.('`test`')
    })

    expect(rendered.onLocalChange.mock.calls).toEqual([
      ['\\`test\\`'],
      ['`test`']
    ])

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(rendered.adapter.save).toHaveBeenCalledTimes(1)
    expect(rendered.adapter.save).toHaveBeenCalledWith({
      content: '`test`\n',
      document: initialDocument,
      keepalive: false
    })
    expect(rendered.onDocumentChange).toHaveBeenCalledWith(storedDocument)

    await act(async () => rendered.root.unmount())
  })

  test('treats a matching watcher event as a save acknowledgment', async () => {
    const pendingSave = deferred<{
      document: TestDocument
      status: 'saved'
    }>()
    const storedDocument: TestDocument = {
      content: 'Draft\n',
      id: 'docs/test.md',
      path: 'docs/test.md',
      version: 'saved-version'
    }
    const rendered = await renderPersistentEditor()
    rendered.adapter.save.mockReturnValue(pendingSave.promise)

    act(() => rendered.props.onChange?.('Draft'))
    await act(async () => vi.advanceTimersByTimeAsync(50))
    act(() => rendered.ref.current?.applyExternalChange(storedDocument))

    expect(rendered.container.textContent).not.toContain(
      'changed while you were editing'
    )
    expect(rendered.onStatusChange).not.toHaveBeenCalledWith('conflict')

    await act(async () => {
      pendingSave.resolve({ document: storedDocument, status: 'saved' })
      await pendingSave.promise
    })
    await act(async () => rendered.root.unmount())
  })

  test('preserves newer typing when a watcher acknowledges an older save', async () => {
    const pendingSave = deferred<{
      document: TestDocument
      status: 'saved'
    }>()
    const firstDocument: TestDocument = {
      content: 'First draft\n',
      id: 'docs/test.md',
      path: 'docs/test.md',
      version: 'first-version'
    }
    const secondDocument: TestDocument = {
      content: 'Second draft\n',
      id: 'docs/test.md',
      path: 'docs/test.md',
      version: 'second-version'
    }
    const rendered = await renderPersistentEditor()
    rendered.adapter.save
      .mockReturnValueOnce(pendingSave.promise)
      .mockResolvedValueOnce({
        document: secondDocument,
        status: 'saved'
      })

    act(() => rendered.props.onChange?.('First draft'))
    await act(async () => vi.advanceTimersByTimeAsync(50))
    act(() => {
      rendered.props.onChange?.('Second draft')
      rendered.ref.current?.applyExternalChange(firstDocument)
    })

    expect(rendered.container.textContent).not.toContain(
      'changed while you were editing'
    )

    await act(async () => {
      pendingSave.resolve({ document: firstDocument, status: 'saved' })
      await pendingSave.promise
      await vi.runAllTimersAsync()
    })

    expect(rendered.adapter.save).toHaveBeenCalledTimes(2)
    expect(rendered.adapter.save).toHaveBeenLastCalledWith({
      content: 'Second draft\n',
      document: firstDocument,
      keepalive: false
    })
    await act(async () => rendered.root.unmount())
  })

  test('accepts a conflict response whose content already matches', async () => {
    const storedDocument: TestDocument = {
      content: 'Already saved\n',
      id: 'docs/test.md',
      path: 'docs/test.md',
      version: 'saved-version'
    }
    const rendered = await renderPersistentEditor()
    rendered.adapter.save.mockResolvedValue({
      document: storedDocument,
      status: 'conflict'
    })

    act(() => rendered.props.onChange?.('Already saved'))
    await act(async () => vi.runAllTimersAsync())

    expect(rendered.container.textContent).not.toContain(
      'changed while you were editing'
    )
    expect(rendered.onStatusChange).not.toHaveBeenCalledWith('conflict')
    await act(async () => rendered.root.unmount())
  })

  test('shows a conflict only for divergent disk content', async () => {
    const diskDocument: TestDocument = {
      content: 'Different edit\n',
      id: 'docs/test.md',
      path: 'docs/test.md',
      version: 'different-version'
    }
    const rendered = await renderPersistentEditor()

    act(() => {
      rendered.props.onChange?.('Local edit')
      rendered.ref.current?.applyExternalChange(diskDocument)
    })

    expect(rendered.container.textContent).toContain(
      'The file on disk changed while you were editing.'
    )
    await act(async () => rendered.root.unmount())
  })
})

