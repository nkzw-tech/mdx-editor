import { fireEvent, render, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  MarkdownEditor,
  type MarkdownEditorHandle
} from '../MarkdownEditor'
import { frontmatterPlugin } from '../plugins/frontmatter'
import { imagePlugin } from '../plugins/image'

afterEach(() => {
  vi.unstubAllGlobals()
})

const mockSuccessfulImageLoads = () => {
  class LoadingImage {
    alt = ''
    height = 0
    onerror: (() => void) | null = null
    onload: (() => void) | null = null
    title = ''
    width = 0
    private attributes = new Map<string, string>()

    set src(_value: string) {
      queueMicrotask(() => this.onload?.())
    }

    get outerHTML() {
      const attributes = [
        this.alt ? `alt="${this.alt}"` : null,
        this.title ? `title="${this.title}"` : null,
        this.width ? `width="${this.width}"` : null,
        this.height ? `height="${this.height}"` : null,
        ...Array.from(this.attributes, ([name, value]) => `${name}="${value}"`)
      ].filter(Boolean)
      return `<img${attributes.length > 0 ? ` ${attributes.join(' ')}` : ''}>`
    }

    setAttribute(name: string, value: string) {
      this.attributes.set(name, value)
    }
  }

  vi.stubGlobal('Image', LoadingImage)
}

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

  test('can suppress raw HTML processing for untrusted Markdown', () => {
    const { container } = render(
      <MarkdownEditor
        colorScheme="light"
        defaultValue={
          '<button onclick="document.body.dataset.probe = \'active\'">Run</button>\n\n<iframe src="https://example.com"></iframe>\n'
        }
        readOnly
        suppressHtmlProcessing
      />
    )

    expect(container.querySelector('button[onclick]')).toBeNull()
    expect(container.querySelector('iframe')).toBeNull()
  })

  test('renders markdown images by default in read-only mode', async () => {
    mockSuccessfulImageLoads()

    const { container } = render(
      <MarkdownEditor
        colorScheme="light"
        defaultValue={
          '![Screenshot](https://gitlab.cfdata.org/uploads/example/screenshot.png)\n'
        }
        readOnly
        suppressHtmlProcessing
      />
    )

    await waitFor(() => {
      expect(container.querySelector('.mdx-editor-content img')).not.toBeNull()
    })
    const image = container.querySelector<HTMLImageElement>(
      '.mdx-editor-content img'
    )
    expect(image).toHaveAttribute(
      'src',
      'https://gitlab.cfdata.org/uploads/example/screenshot.png'
    )
    expect(image).toHaveAttribute('alt', 'Screenshot')
  })

  test('allows consumers to pass an explicit image plugin', async () => {
    mockSuccessfulImageLoads()

    const { container } = render(
      <MarkdownEditor
        additionalPlugins={[imagePlugin()]}
        colorScheme="light"
        defaultValue={
          '![Screenshot](https://gitlab.cfdata.org/uploads/example/screenshot.png)\n'
        }
        readOnly
        suppressHtmlProcessing
      />
    )

    await waitFor(() => {
      expect(container.querySelector('.mdx-editor-content img')).not.toBeNull()
    })
    expect(container.querySelector('.mdx-editor-content img')).toHaveAttribute(
      'src',
      'https://gitlab.cfdata.org/uploads/example/screenshot.png'
    )
  })

  test('renders GitLab image dimensions without leaking the attribute suffix', async () => {
    mockSuccessfulImageLoads()

    const { container } = render(
      <MarkdownEditor
        colorScheme="light"
        defaultValue={
          '![Large image](https://gitlab.cfdata.org/uploads/example/image.png){width=1531 height=800}\n'
        }
        readOnly
        suppressHtmlProcessing
      />
    )

    await waitFor(() => {
      expect(container.querySelector('.mdx-editor-content img')).not.toBeNull()
    })
    const image = container.querySelector<HTMLImageElement>(
      '.mdx-editor-content img'
    )
    expect(image).toHaveAttribute(
      'src',
      'https://gitlab.cfdata.org/uploads/example/image.png'
    )
    expect(image).toHaveAttribute('width', '1531')
    expect(image).toHaveAttribute('height', '800')
    expect(container).not.toHaveTextContent('{width=1531 height=800}')
  })

  test('renders video uploads as controlled video media', async () => {
    const { container } = render(
      <MarkdownEditor
        colorScheme="light"
        defaultValue={
          '![Screen recording](https://gitlab.cfdata.org/uploads/example/recording.mov){width=816 height=600}\n'
        }
        readOnly
        suppressHtmlProcessing
      />
    )

    await waitFor(() => {
      expect(container.querySelector('.mdx-editor-content video')).not.toBeNull()
    })
    const video = container.querySelector<HTMLVideoElement>(
      '.mdx-editor-content video'
    )
    expect(container.querySelector('.mdx-editor-content img')).toBeNull()
    expect(video).toHaveAttribute('controls')
    expect(video).toHaveAttribute(
      'src',
      'https://gitlab.cfdata.org/uploads/example/recording.mov'
    )
    expect(video).toHaveAttribute('width', '816')
    expect(video).toHaveAttribute('height', '600')
    expect(container).not.toHaveTextContent('{width=816 height=600}')
  })

  test('does not mark read-only table data columns as tool columns', () => {
    const tableMarkdown =
      '| Status | Description | Result |\n| --- | --- | --- |\n| Pass | Uses a readable table layout | Good |\n'
    const editable = render(<MarkdownEditor colorScheme="light" defaultValue={tableMarkdown} />)
    expect(
      editable.container.querySelectorAll('.mdx-editor-content table col[data-tool-column]')
    ).toHaveLength(2)
    expect(editable.container.querySelector('.mdx-editor-shell')).not.toHaveAttribute(
      'data-read-only'
    )
    editable.unmount()

    const { container } = render(
      <MarkdownEditor
        colorScheme="light"
        defaultValue={tableMarkdown}
        readOnly
      />
    )

    const columns = container.querySelectorAll('.mdx-editor-content table colgroup > col')
    expect(columns).toHaveLength(3)
    expect(container.querySelector('.mdx-editor-shell')).toHaveAttribute(
      'data-read-only',
      'true'
    )
    expect(container.querySelector('.mdx-editor-content table col[data-tool-column]')).toBeNull()
  })
})
