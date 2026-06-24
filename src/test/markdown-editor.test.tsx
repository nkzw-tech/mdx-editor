import { fireEvent, render, waitFor } from '@testing-library/react'
import React from 'react'
import { describe, expect, test, vi } from 'vitest'
import {
  MarkdownEditor,
  type MarkdownEditorHandle
} from '../MarkdownEditor'
import { frontmatterPlugin } from '../plugins/frontmatter'

describe('MarkdownEditor defaults', () => {
  test('renders unordered and ordered lists as semantic lists', () => {
    const { container } = render(
      <MarkdownEditor
        colorScheme="light"
        defaultValue={'- First\n- Second\n\n1. One\n2. Two\n'}
      />
    )

    expect(container.querySelectorAll('.mdx-editor-content ul > li')).toHaveLength(2)
    expect(container.querySelectorAll('.mdx-editor-content ol > li')).toHaveLength(2)
  })

  test('renders and edits frontmatter without turning it into document headings', async () => {
    const scrollHeight = vi
      .spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get')
      .mockReturnValue(68)
    const editorRef = React.createRef<MarkdownEditorHandle>()
    const { container, getByLabelText } = render(
      <MarkdownEditor
        additionalPlugins={[frontmatterPlugin()]}
        colorScheme="light"
        defaultValue={'---\ntitle: Example\ntags:\n  - plans\n---\n\n# Body\n'}
        ref={editorRef}
      />
    )

    const frontmatter = getByLabelText('Frontmatter YAML')
    expect(frontmatter).toHaveValue('title: Example\ntags:\n  - plans')
    expect(frontmatter).toHaveAttribute('data-autogrow')
    expect(frontmatter).toHaveStyle({ height: '68px' })
    expect(container.querySelectorAll('.mdx-editor-content h1')).toHaveLength(1)
    expect(container.querySelector('.mdx-editor-content h2')).toBeNull()

    fireEvent.change(frontmatter, {
      target: { value: 'title: Updated\ndraft: true' }
    })

    await waitFor(() => {
      expect(editorRef.current?.getMarkdown()).toContain(
        '---\ntitle: Updated\ndraft: true\n---'
      )
    })
    scrollHeight.mockRestore()
  })

  test('renders fenced code without line-number or folding gutters', async () => {
    const { container } = render(
      <MarkdownEditor
        colorScheme="light"
        defaultValue={'```sh\npnpm test\n```\n'}
      />
    )

    await waitFor(() => {
      expect(container.querySelector('.cm-editor')).not.toBeNull()
    })
    expect(container.querySelector('.cm-gutters')).toBeNull()
    expect(container.querySelector('.cm-content')).toHaveTextContent('pnpm test')
    const languageSelect = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Language"]'
    )
    expect(languageSelect).not.toBeNull()
    expect(languageSelect?.closest('[class*="tooltipTrigger"]')).toBeNull()
  })
})
