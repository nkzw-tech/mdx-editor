import { act, fireEvent, render, waitFor } from '@testing-library/react'
import React from 'react'
import { expect, test, vi } from 'vitest'
import {
  MarkdownEditor,
  type MarkdownEditorHandle
} from '../MarkdownEditor'
import type { MarkdownAnnotationAnchor } from '../annotations'

const hashText = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

test('text annotations never become part of exported Markdown', async () => {
  const markdown = 'Review this exact sentence.'
  const anchor: MarkdownAnnotationAnchor = {
    block: {
      fingerprint: hashText(`paragraph\0${markdown}`),
      path: [0],
      text: markdown,
      type: 'paragraph'
    },
    kind: 'text',
    quote: {
      end: 17,
      exact: 'this exact',
      prefix: 'Review ',
      start: 7,
      suffix: ' sentence.'
    },
    version: 1
  }
  const editorRef = React.createRef<MarkdownEditorHandle>()
  const { container } = render(
    <MarkdownEditor
      colorScheme="light"
      defaultValue={markdown}
      ref={editorRef}
    />
  )

  act(() => {
    expect(
      editorRef.current?.createAnnotation('thread-1', {
        anchor,
        label: 'Selection',
        rect: { height: 0, left: 0, top: 0, width: 0 }
      })
    ).toEqual(anchor)
  })

  await waitFor(() => {
    expect(
      container.querySelector('mark[data-mdx-annotation-ids="thread-1"]')
    ).not.toBeNull()
  })
  expect(editorRef.current?.getMarkdown()).toBe(markdown)

  act(() => editorRef.current?.removeAnnotation('thread-1'))
  await waitFor(() => {
    expect(container.querySelector('mark')).toBeNull()
  })
  expect(editorRef.current?.getMarkdown()).toBe(markdown)
})

test('text annotations repair after the Markdown document is replaced', async () => {
  const markdown = 'Review this exact sentence.'
  const anchor: MarkdownAnnotationAnchor = {
    block: {
      fingerprint: hashText(`paragraph\0${markdown}`),
      path: [0],
      text: markdown,
      type: 'paragraph'
    },
    kind: 'text',
    quote: {
      end: 17,
      exact: 'this exact',
      prefix: 'Review ',
      start: 7,
      suffix: ' sentence.'
    },
    version: 1
  }
  const editorRef = React.createRef<MarkdownEditorHandle>()
  const { container, rerender } = render(
    <MarkdownEditor
      annotations={[{ anchor, id: 'thread-1' }]}
      colorScheme="light"
      ref={editorRef}
      value={markdown}
    />
  )

  await waitFor(() => {
    expect(
      container.querySelector('mark[data-mdx-annotation-ids="thread-1"]')
    ).not.toBeNull()
  })

  const nextMarkdown = `A new introduction.\n\n${markdown}`
  rerender(
    <MarkdownEditor
      annotations={[{ anchor, id: 'thread-1' }]}
      colorScheme="light"
      ref={editorRef}
      value={nextMarkdown}
    />
  )

  await waitFor(() => {
    expect(
      container.querySelector('mark[data-mdx-annotation-ids="thread-1"]')
        ?.textContent
    ).toBe('this exact')
  })
  expect(editorRef.current?.getMarkdown()).toBe(nextMarkdown)
})

test('list items are exposed as commentable list-item blocks', async () => {
  const { container } = render(
    <MarkdownEditor colorScheme="light" defaultValue={'- First\n- Second'} />
  )

  await waitFor(() => {
    expect(
      container.querySelectorAll(
        'li[data-mdx-comment-block-type="listitem"]'
      )
    ).toHaveLength(2)
  })
})

test('comment targets publish updated geometry while scrolling', async () => {
  const onCommentTargetChange = vi.fn()
  const { container } = render(
    <MarkdownEditor
      colorScheme="light"
      defaultValue="Follow this paragraph."
      onCommentTargetChange={onCommentTargetChange}
    />
  )
  const paragraph = await waitFor(() => {
    const element = container.querySelector<HTMLElement>(
      'p[data-mdx-comment-block]'
    )
    expect(element).not.toBeNull()
    return element!
  })
  let top = 120
  paragraph.getBoundingClientRect = () =>
    ({
      bottom: top + 24,
      height: 24,
      left: 40,
      right: 340,
      top,
      width: 300,
      x: 40,
      y: top,
      toJSON: () => ({})
    }) as DOMRect

  fireEvent.pointerMove(paragraph)
  await waitFor(() => {
    expect(onCommentTargetChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        rect: expect.objectContaining({ top: 120 })
      })
    )
  })

  onCommentTargetChange.mockClear()
  fireEvent.pointerMove(
    container.querySelector<HTMLElement>('.mdx-editor-content')!
  )
  expect(onCommentTargetChange).not.toHaveBeenCalled()

  top = 72
  fireEvent.scroll(window)
  await waitFor(() => {
    expect(onCommentTargetChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        rect: expect.objectContaining({ top: 72 })
      })
    )
  })
})
