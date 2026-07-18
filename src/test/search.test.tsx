/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { Realm, useCellValue, useRealm } from '@mdxeditor/gurx'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EmptyTextNodeIndex,
  MDXEditor,
  type MDXEditorMethods,
  MDX_FOCUS_SEARCH_NAME,
  MDX_SEARCH_NAME,
  debouncedIndexer$,
  editorSearchCursor$,
  editorSearchRanges$,
  editorSearchScrollableContent$,
  editorSearchTerm$,
  editorSearchTermDebounced$,
  editorSearchTextNodeIndex$,
  linkPlugin,
  rangeSearchScan,
  searchOpen$,
  searchPlugin,
  toolbarPlugin,
  useEditorSearch
} from '../core.js'
import { contentEditableRef$ } from '../plugins/core/index.js'

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

class TestHighlight {
  readonly ranges: Range[]

  constructor(...ranges: Range[]) {
    this.ranges = ranges
  }
}

const highlights = new Map<string, TestHighlight>()
let originalCssDescriptor: PropertyDescriptor | undefined
let originalHighlightDescriptor: PropertyDescriptor | undefined

beforeEach(() => {
  highlights.clear()
  originalCssDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'CSS')
  originalHighlightDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Highlight')
  Object.defineProperty(globalThis, 'CSS', { configurable: true, value: { highlights } })
  Object.defineProperty(globalThis, 'Highlight', { configurable: true, value: TestHighlight })
})

afterEach(() => {
  if (originalCssDescriptor) Object.defineProperty(globalThis, 'CSS', originalCssDescriptor)
  else Reflect.deleteProperty(globalThis, 'CSS')
  if (originalHighlightDescriptor) Object.defineProperty(globalThis, 'Highlight', originalHighlightDescriptor)
  else Reflect.deleteProperty(globalThis, 'Highlight')
  vi.useRealTimers()
})

const SearchControls = () => {
  const realm = useRealm()
  const search = useEditorSearch()
  const textNodeIndex = useCellValue(editorSearchTextNodeIndex$)

  return (
    <div>
      <input
        aria-label="Search term"
        value={search.search}
        onChange={(event) => {
          search.setSearch(event.target.value)
        }}
      />
      <output aria-label="Search total">{search.total}</output>
      <output aria-label="Search cursor">{search.cursor}</output>
      <output aria-label="Current match">{search.currentRange?.toString() ?? ''}</output>
      <output aria-label="Search open">{String(search.isSearchOpen)}</output>
      <output aria-label="Search indexed text">{textNodeIndex.allText}</output>
      <button type="button" onClick={search.openSearch}>
        Open search
      </button>
      <button type="button" onClick={search.closeSearch}>
        Close search
      </button>
      <button
        type="button"
        onClick={() => {
          search.setIsSearchOpen(false)
        }}
      >
        Close with setter
      </button>
      <button
        type="button"
        onClick={() => {
          realm.pub(searchOpen$, false)
        }}
      >
        Close with cell
      </button>
      <button type="button" onClick={search.next}>
        Next match
      </button>
      <button type="button" onClick={search.prev}>
        Previous match
      </button>
      <button
        type="button"
        onClick={() => {
          search.replace('$&')
        }}
      >
        Replace match
      </button>
      <button
        type="button"
        onClick={() => {
          search.replaceAll('$&')
        }}
      >
        Replace all
      </button>
      <button
        type="button"
        onClick={() => {
          if (search.currentRange) search.scrollToRangeOrIndex(search.currentRange, { ignoreIfInView: false, behavior: 'auto' })
        }}
      >
        Scroll supplied range
      </button>
      <button
        type="button"
        onClick={() => {
          search.scrollToRangeOrIndex(1, { ignoreIfInView: true, behavior: 'smooth' })
        }}
      >
        Scroll first index
      </button>
    </div>
  )
}

function renderSearchEditor(markdown: string, onChange = vi.fn()) {
  const ref = React.createRef<MDXEditorMethods>()
  render(
    <MDXEditor
      ref={ref}
      markdown={markdown}
      onChange={onChange}
      plugins={[
        linkPlugin(),
        searchPlugin(),
        toolbarPlugin({
          toolbarContents: () => <SearchControls />
        })
      ]}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: 'Open search' }))
  return ref
}

async function setSearch(term: string) {
  fireEvent.change(screen.getByLabelText('Search term'), { target: { value: term } })
  await waitFor(() => {
    expect(screen.getByLabelText('Search term')).toHaveValue(term)
  })
}

async function waitForTotal(total: number) {
  await waitFor(() => {
    expect(screen.getByLabelText('Search total')).toHaveTextContent(String(total))
  })
}

describe('public search cells and helpers', () => {
  it('keeps every public cell observable and preserves debounce/link behavior', async () => {
    vi.useFakeTimers()
    const realm = new Realm()
    const termValues: string[] = []
    const rangeValues: Range[][] = []
    const cursorValues: number[] = []
    const openValues: boolean[] = []
    const indexValues: string[] = []
    const scrollValues: (HTMLElement | null)[] = []

    realm.sub(editorSearchTerm$, (value) => termValues.push(value))
    realm.sub(editorSearchRanges$, (value) => rangeValues.push(value))
    realm.sub(editorSearchCursor$, (value) => cursorValues.push(value))
    realm.sub(searchOpen$, (value) => openValues.push(value))
    realm.sub(editorSearchTextNodeIndex$, (value) => indexValues.push(value.allText))
    realm.sub(editorSearchScrollableContent$, (value) => scrollValues.push(value))

    const range = document.createRange()
    const directIndex = { allText: 'direct', nodeIndex: [], offsetIndex: [] }
    realm.pub(editorSearchRanges$, [range])
    realm.pub(editorSearchCursor$, 2)
    realm.pub(searchOpen$, true)
    realm.pub(editorSearchTerm$, 'direct')
    realm.pub(editorSearchTextNodeIndex$, directIndex)

    const wrapper = document.createElement('div')
    const editable = document.createElement('div')
    wrapper.append(editable)
    realm.pub(contentEditableRef$, { current: editable })

    realm.pub(editorSearchTermDebounced$, 'debounced')
    realm.pub(debouncedIndexer$, { allText: 'debounced-index', nodeIndex: [], offsetIndex: [] })
    await vi.advanceTimersByTimeAsync(251)

    expect(termValues).toContain('direct')
    expect(termValues.at(-1)).toBe('debounced')
    expect(rangeValues.at(-1)).toEqual([range])
    expect(cursorValues.at(-1)).toBe(2)
    expect(openValues.at(-1)).toBe(true)
    expect(indexValues).toContain('direct')
    expect(indexValues.at(-1)).toBe('debounced-index')
    expect(scrollValues.at(-1)).toBe(wrapper)
    expect(realm.getValue(editorSearchTextNodeIndex$)).not.toBe(EmptyTextNodeIndex)
  })

  it('scans a consumer-created TextNodeIndex across nodes and normalized offsets', () => {
    const first = document.createTextNode('alpha ')
    const second = document.createTextNode('ALPHA')
    const container = document.createElement('div')
    container.append(first, second)
    const nodeIndex = [...Array.from({ length: 6 }, () => first), ...Array.from({ length: 5 }, () => second)]
    const offsetIndex = [...Array.from({ length: 6 }, (_, index) => index), ...Array.from({ length: 5 }, (_, index) => index)]
    const ranges = Array.from(rangeSearchScan('alpha.*alpha', { allText: 'alpha ALPHA', nodeIndex, offsetIndex }))

    expect(ranges).toHaveLength(1)
    expect(ranges[0]?.toString()).toBe('alpha ALPHA')

    const composed = document.createTextNode('é')
    const [normalizedRange] = Array.from(
      rangeSearchScan('e\u0301', { allText: 'e\u0301', nodeIndex: [composed, composed], offsetIndex: [0, 0] })
    )
    expect(normalizedRange?.toString()).toBe('é')
  })
})

describe('state-backed search and replacement', () => {
  it('tracks programmatic mutation and recovers from invalid and zero-length regexes', async () => {
    const ref = renderSearchEditor('al**pha** beta alpha KEEP')
    await setSearch('alpha')
    await waitForTotal(2)
    expect(screen.getByLabelText('Current match')).toHaveTextContent('alpha')
    expect(highlights.get(MDX_SEARCH_NAME)?.ranges).toHaveLength(2)
    expect(highlights.get(MDX_FOCUS_SEARCH_NAME)?.ranges).toHaveLength(1)

    act(() => {
      ref.current?.setMarkdown('prefix alpha and alpha')
    })
    await waitForTotal(2)

    await setSearch('[')
    await waitForTotal(0)
    expect(ref.current?.getMarkdown()).toBe('prefix alpha and alpha')

    await setSearch('^')
    await waitForTotal(0)
    await setSearch('alpha')
    await waitForTotal(2)

    fireEvent.click(screen.getByRole('button', { name: 'Close with setter' }))
    expect(highlights.size).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Open search' }))
    await waitForTotal(2)
    fireEvent.click(screen.getByRole('button', { name: 'Close with cell' }))
    expect(highlights.size).toBe(0)
  })

  it('replaces split and repeated matches literally in one editor change', async () => {
    const onChange = vi.fn()
    const ref = renderSearchEditor('al**pha** beta alpha KEEP', onChange)
    await setSearch('alpha')
    await waitForTotal(2)
    const changesBefore = onChange.mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'Replace all' }))
    await waitFor(() => {
      expect(ref.current?.getMarkdown()).toBe('$& beta $& KEEP')
    })

    expect(onChange.mock.calls.length - changesBefore).toBe(1)
    expect(screen.getByLabelText('Search total')).toHaveTextContent('0')
  })

  it('replaces a complete linked-text match without detaching its text node', async () => {
    const ref = renderSearchEditor('[alpha](https://example.com) and alpha')
    await setSearch('alpha')
    await waitForTotal(2)

    fireEvent.click(screen.getByRole('button', { name: 'Replace all' }))

    await waitFor(() => {
      expect(ref.current?.getMarkdown()).toBe('[$&](https://example.com) and $&')
    })
    expect(screen.getByLabelText('Search total')).toHaveTextContent('0')
  })

  it('fails closed when the document changes between scan and replacement', async () => {
    const ref = renderSearchEditor('alpha alpha')
    await setSearch('alpha')
    await waitForTotal(2)

    act(() => {
      ref.current?.setMarkdown('fresh alpha')
      fireEvent.click(screen.getByRole('button', { name: 'Replace all' }))
    })

    await waitFor(() => {
      expect(ref.current?.getMarkdown()).toBe('fresh alpha')
    })
    await waitForTotal(1)
  })

  it('replaces a match spanning adjacent blocks without changing surrounding text', async () => {
    const ref = renderSearchEditor('before alpha\n\nKEEP after')
    await setSearch('alphaKEEP')
    await waitForTotal(1)

    fireEvent.click(screen.getByRole('button', { name: 'Replace all' }))

    await waitFor(() => {
      expect(ref.current?.getMarkdown()).toBe('before $& after')
    })
    expect(screen.getByLabelText('Search total')).toHaveTextContent('0')
  })

  it('supports public navigation and both external scrolling call shapes', async () => {
    const originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo')
    const originalGetClientRects = Object.getOwnPropertyDescriptor(Range.prototype, 'getClientRects')
    const scrollTo = vi.fn()
    const rect = { top: 20, bottom: 30, height: 10, left: 0, right: 10, width: 10, x: 0, y: 20, toJSON: () => ({}) }
    const getClientRects = vi.fn(() => ({
      0: rect,
      length: 1,
      item: (index: number) => (index === 0 ? (rect as DOMRect) : null),
      [Symbol.iterator]: () => [rect as DOMRect].values()
    }))
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: scrollTo })
    Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: getClientRects })
    renderSearchEditor('alpha beta alpha')
    await setSearch('alpha')
    await waitForTotal(2)

    fireEvent.click(screen.getByRole('button', { name: 'Next match' }))
    expect(screen.getByLabelText('Search cursor')).toHaveTextContent('2')
    fireEvent.click(screen.getByRole('button', { name: 'Previous match' }))
    expect(screen.getByLabelText('Search cursor')).toHaveTextContent('1')
    fireEvent.click(screen.getByRole('button', { name: 'Scroll supplied range' }))
    fireEvent.click(screen.getByRole('button', { name: 'Scroll first index' }))

    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }))
    expect(getClientRects).toHaveBeenCalled()
    if (originalScrollTo) Object.defineProperty(HTMLElement.prototype, 'scrollTo', originalScrollTo)
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo')
    if (originalGetClientRects) Object.defineProperty(Range.prototype, 'getClientRects', originalGetClientRects)
    else Reflect.deleteProperty(Range.prototype, 'getClientRects')
  })
})
