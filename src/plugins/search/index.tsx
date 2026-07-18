/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { Cell, debounceTime, useCell, useCellValue, useRealm } from '@mdxeditor/gurx'
import { createDOMRange } from '@lexical/selection'
import { $createRangeSelection, $getNodeByKey, $getRoot, $isTextNode, HISTORY_PUSH_TAG, type LexicalEditor, type NodeKey } from 'lexical'
import { realmPlugin } from '../../RealmWithPlugins.js'
import { activeEditor$, contentEditableRef$, createActiveEditorSubscription$ } from '../core/index.js'

export const EmptyTextNodeIndex: TextNodeIndex = {
  allText: '',
  nodeIndex: [],
  offsetIndex: []
}
export const editorSearchTerm$ = Cell<string>('')
export const editorSearchRanges$ = Cell<Range[]>([])
export const editorSearchCursor$ = Cell<number>(0)
export const editorSearchTextNodeIndex$ = Cell<TextNodeIndex>(EmptyTextNodeIndex)

export const searchOpen$ = Cell<boolean>(false)
export const editorSearchTermDebounced$ = Cell<string>('', (realm) => {
  realm.link(editorSearchTermDebounced$, realm.pipe(editorSearchTerm$, realm.transformer(debounceTime(250))))
})
export const editorSearchScrollableContent$ = Cell<HTMLElement | null>(null, (r) =>
  r.sub(contentEditableRef$, (cref) => {
    r.pub(editorSearchScrollableContent$, cref?.current?.parentElement ?? null)
  })
)

export const MDX_SEARCH_NAME = 'MdxSearch'
export const MDX_FOCUS_SEARCH_NAME = 'MdxFocusSearch'

export interface TextNodeIndex {
  allText: string
  nodeIndex: Node[]
  offsetIndex: number[]
}

export const debouncedIndexer$ = Cell<TextNodeIndex>(EmptyTextNodeIndex, (realm) => {
  realm.link(debouncedIndexer$, realm.pipe(editorSearchTextNodeIndex$, realm.transformer(debounceTime(250))))
})

interface SearchPoint {
  key: NodeKey
  offset: number
}

interface SearchUnit {
  key: NodeKey
  startOffset: number
  endOffset: number
}

interface SearchSnapshot {
  editor: LexicalEditor
  text: string
  units: SearchUnit[]
}

interface SearchStateMatch {
  editor: LexicalEditor
  start: SearchPoint
  end: SearchPoint
}

const editorSearchActiveEditor$ = Cell<LexicalEditor | null>(null)
const editorSearchStateMatches$ = Cell<SearchStateMatch[]>([])

function* searchText(allText: string, searchQuery: string): Generator<[start: number, end: number]> {
  if (!searchQuery) {
    return
  }

  let regex: RegExp
  try {
    regex = new RegExp(searchQuery, 'gi')
  } catch {
    return
  }

  let match: RegExpExecArray | null
  while ((match = regex.exec(allText)) !== null) {
    if (match[0].length === 0) {
      if (regex.lastIndex === match.index) {
        regex.lastIndex++
      }
      continue
    }

    yield [match.index, match.index + match[0].length - 1]
  }
}

export function* rangeSearchScan(searchQuery: string, { allText, offsetIndex, nodeIndex }: TextNodeIndex) {
  for (const [start, end] of searchText(allText, searchQuery)) {
    const startOffset = offsetIndex[start]
    const endOffset = offsetIndex[end]
    const startNode = nodeIndex[start]
    const endNode = nodeIndex[end]
    const ownerDocument = startNode?.ownerDocument ?? document
    const range = ownerDocument.createRange()

    if (startNode === undefined || endNode === undefined || startOffset === undefined || endOffset === undefined) {
      throw new Error('Invalid range: startNode, endNode, startOffset, or endOffset is undefined.')
    }

    range.setStart(startNode, startOffset)
    range.setEnd(endNode, endOffset + 1)
    yield range
  }
}

function createSearchSnapshot(editor: LexicalEditor): SearchSnapshot {
  let text = ''
  const units: SearchUnit[] = []

  for (const node of $getRoot().getAllTextNodes()) {
    const nodeText = node.getTextContent()
    let sourceOffset = 0

    while (sourceOffset < nodeText.length) {
      const codePoint = nodeText.codePointAt(sourceOffset)
      if (codePoint === undefined) break

      const sourceUnit = String.fromCodePoint(codePoint)
      const normalizedUnit = sourceUnit.normalize('NFKD')
      const mapsOneToOne = normalizedUnit.length === sourceUnit.length

      for (let normalizedOffset = 0; normalizedOffset < normalizedUnit.length; normalizedOffset++) {
        const startOffset = mapsOneToOne ? sourceOffset + normalizedOffset : sourceOffset
        const endOffset = mapsOneToOne ? startOffset + 1 : sourceOffset + sourceUnit.length
        units.push({ key: node.getKey(), startOffset, endOffset })
        text += normalizedUnit[normalizedOffset] ?? ''
      }

      sourceOffset += sourceUnit.length
    }
  }

  return { editor, text, units }
}

function findStateMatches(snapshot: SearchSnapshot, searchQuery: string): SearchStateMatch[] {
  const matches: SearchStateMatch[] = []

  for (const [startIndex, endIndex] of searchText(snapshot.text, searchQuery)) {
    const startUnit = snapshot.units[startIndex]
    const endUnit = snapshot.units[endIndex]
    if (!startUnit || !endUnit) continue

    matches.push({
      editor: snapshot.editor,
      start: { key: startUnit.key, offset: startUnit.startOffset },
      end: { key: endUnit.key, offset: endUnit.endOffset }
    })
  }

  return matches
}

function projectSnapshot(snapshot: SearchSnapshot, matches: SearchStateMatch[]) {
  const nodeIndex: Node[] = []
  const offsetIndex: number[] = []
  const domTextNodes = new Map<NodeKey, Node>()
  const projectedMatches: { match: SearchStateMatch; range: Range }[] = []
  let projectionComplete = true

  snapshot.editor.getEditorState().read(() => {
    for (const unit of snapshot.units) {
      let domTextNode = domTextNodes.get(unit.key)
      if (!domTextNode) {
        const lexicalNode = $getNodeByKey(unit.key)
        if (!$isTextNode(lexicalNode)) {
          projectionComplete = false
          break
        }
        const nodeRange = createDOMRange(snapshot.editor, lexicalNode, 0, lexicalNode, lexicalNode.getTextContentSize())
        if (!nodeRange || nodeRange.startContainer !== nodeRange.endContainer) {
          projectionComplete = false
          break
        }
        domTextNode = nodeRange.startContainer
        domTextNodes.set(unit.key, domTextNode)
      }
      nodeIndex.push(domTextNode)
      offsetIndex.push(unit.startOffset)
    }

    for (const match of matches) {
      const startNode = $getNodeByKey(match.start.key)
      const endNode = $getNodeByKey(match.end.key)
      if (!$isTextNode(startNode) || !$isTextNode(endNode)) continue

      const range = createDOMRange(snapshot.editor, startNode, match.start.offset, endNode, match.end.offset)
      if (range) projectedMatches.push({ match, range })
    }
  })

  return {
    index: projectionComplete ? { allText: snapshot.text, nodeIndex, offsetIndex } : EmptyTextNodeIndex,
    projectedMatches
  }
}

function supportsHighlights() {
  return typeof CSS !== 'undefined' && typeof CSS.highlights !== 'undefined' && typeof Highlight !== 'undefined'
}

const focusHighlightRange = (range?: Range | null) => {
  if (!supportsHighlights()) return
  CSS.highlights.delete(MDX_FOCUS_SEARCH_NAME)
  if (range) CSS.highlights.set(MDX_FOCUS_SEARCH_NAME, new Highlight(range))
}

const highlightRanges = (ranges: Range[] | Iterable<Range>) => {
  if (!supportsHighlights()) return
  CSS.highlights.set(MDX_SEARCH_NAME, new Highlight(...ranges))
}

const resetHighlights = () => {
  if (!supportsHighlights()) return
  CSS.highlights.delete(MDX_SEARCH_NAME)
  CSS.highlights.delete(MDX_FOCUS_SEARCH_NAME)
}

const scrollToRange = (
  range: Range,
  contentEditable: HTMLElement | undefined,
  options?: {
    scrollElement?: HTMLElement
    ignoreIfInView?: boolean
    behavior?: ScrollBehavior
  }
) => {
  const ignoreIfInView = options?.ignoreIfInView ?? true
  const behavior = options?.behavior ?? 'smooth'
  const [first] = range.getClientRects()

  if (!contentEditable) {
    console.warn('No content-editable element found for scrolling.')
    return
  }
  if (!first) {
    console.warn('No client rect found for the range, cannot scroll.')
    return
  }

  const containerRect = contentEditable.getBoundingClientRect()
  const topRelativeToContainer = first.top - containerRect.top
  const bottomRelativeToContainer = first.bottom - containerRect.top
  if (ignoreIfInView) {
    const rangeTop = topRelativeToContainer + contentEditable.scrollTop
    const rangeBottom = bottomRelativeToContainer + contentEditable.scrollTop
    const visibleTop = contentEditable.scrollTop
    const visibleBottom = visibleTop + contentEditable.clientHeight

    if (rangeTop >= visibleTop && rangeBottom <= visibleBottom) return
  }

  const top = topRelativeToContainer + contentEditable.scrollTop - first.height
  contentEditable.scrollTo({ top, behavior })
}

function isSameStart(first: SearchStateMatch | undefined, second: SearchStateMatch) {
  return first?.editor === second.editor && first.start.key === second.start.key && first.start.offset === second.start.offset
}

function clearSearchResults(realm: ReturnType<typeof useRealm>) {
  realm.pubIn({
    [editorSearchStateMatches$]: [],
    [editorSearchRanges$]: [],
    [editorSearchCursor$]: 0
  })
  resetHighlights()
}

function refreshSearch(
  realm: ReturnType<typeof useRealm>,
  editor: LexicalEditor,
  advanceFrom?: { cursor: number; match: SearchStateMatch }
) {
  if (realm.getValue(editorSearchActiveEditor$) !== editor) return

  let snapshot!: SearchSnapshot
  editor.getEditorState().read(() => {
    snapshot = createSearchSnapshot(editor)
  })

  const searchOpen = realm.getValue(searchOpen$)
  const searchQuery = realm.getValue(editorSearchTerm$)
  const stateMatches = searchOpen ? findStateMatches(snapshot, searchQuery) : []
  const { index, projectedMatches } = projectSnapshot(snapshot, stateMatches)

  if (searchOpen) {
    realm.pub(editorSearchTextNodeIndex$, index)
  } else {
    realm.pub(debouncedIndexer$, index)
  }

  if (!searchOpen || !searchQuery || projectedMatches.length === 0) {
    clearSearchResults(realm)
    return
  }

  const matches = projectedMatches.map(({ match }) => match)
  const ranges = projectedMatches.map(({ range }) => range)
  const previousCursor = realm.getValue(editorSearchCursor$)
  let cursor = Math.min(Math.max(previousCursor, 1), ranges.length)

  if (advanceFrom && isSameStart(matches[advanceFrom.cursor - 1], advanceFrom.match)) {
    cursor = (advanceFrom.cursor % ranges.length) + 1
  }

  realm.pubIn({
    [editorSearchStateMatches$]: matches,
    [editorSearchRanges$]: ranges,
    [editorSearchCursor$]: cursor
  })
  highlightRanges(ranges)
  focusHighlightRange(ranges[cursor - 1])
}

function resolveMatch(match: SearchStateMatch) {
  const startNode = $getNodeByKey(match.start.key)
  const endNode = $getNodeByKey(match.end.key)
  if (!$isTextNode(startNode) || !$isTextNode(endNode)) return null
  if (match.start.offset < 0 || match.start.offset > startNode.getTextContentSize()) return null
  if (match.end.offset < 0 || match.end.offset > endNode.getTextContentSize()) return null
  return { startNode, endNode }
}

function replaceStateMatches(editor: LexicalEditor, matches: SearchStateMatch[], replacement: string, onUpdate?: () => void) {
  if (matches.length === 0 || matches.some((match) => match.editor !== editor)) return

  editor.update(
    () => {
      if (matches.some((match) => resolveMatch(match) === null)) return

      for (let index = matches.length - 1; index >= 0; index--) {
        const match = matches[index]
        if (!match) continue
        const resolved = resolveMatch(match)
        if (!resolved) {
          throw new Error('Search match became stale during replacement.')
        }

        if (resolved.startNode.is(resolved.endNode)) {
          const replacedNode = resolved.startNode.spliceText(match.start.offset, match.end.offset - match.start.offset, replacement, true)
          if (replacedNode.getTextContentSize() === 0) {
            replacedNode.remove()
          }
          continue
        }

        const selection = $createRangeSelection()
        selection.anchor.set(resolved.startNode.getKey(), match.start.offset, 'text')
        selection.focus.set(resolved.endNode.getKey(), match.end.offset, 'text')
        selection.insertText(replacement)
      }
    },
    {
      tag: HISTORY_PUSH_TAG,
      onUpdate
    }
  )
}

export function useEditorSearch() {
  const realm = useRealm()
  const ranges = useCellValue(editorSearchRanges$)
  const cursor = useCellValue(editorSearchCursor$)
  const search = useCellValue(editorSearchTerm$)
  const currentRange: Range | null = cursor > 0 ? ranges.at(cursor - 1) ?? null : null
  const contentEditable = useCellValue(editorSearchScrollableContent$)
  const [isSearchOpen, setIsSearchOpen] = useCell(searchOpen$)

  const openSearch = () => {
    setIsSearchOpen(true)
  }
  const closeSearch = () => {
    setIsSearchOpen(false)
  }
  const toggleSearch = () => {
    setIsSearchOpen(!isSearchOpen)
  }

  const scrollToRangeOrIndex = (range: Range | number, options?: { ignoreIfInView?: boolean; behavior?: ScrollBehavior }) => {
    const scrollRange = typeof range === 'number' ? ranges[range - 1] : range
    if (!scrollRange) {
      throw new Error('Error scrolling to range, range does not exist')
    }
    scrollToRange(scrollRange, contentEditable ?? undefined, options)
  }

  const setSearch = (term: string | null) => {
    if ((term ?? '') !== search) {
      realm.pub(editorSearchCursor$, 0)
    }
    realm.pub(editorSearchTermDebounced$, term ?? '')
  }

  const next = () => {
    if (!ranges.length) return
    const newCursor = (cursor % ranges.length) + 1
    scrollToRangeOrIndex(newCursor)
    realm.pub(editorSearchCursor$, newCursor)
  }

  const prev = () => {
    if (!ranges.length) return
    const newCursor = cursor <= 1 ? ranges.length : cursor - 1
    scrollToRangeOrIndex(newCursor)
    realm.pub(editorSearchCursor$, newCursor)
  }

  const replace = (replacement: string, onUpdate?: () => void) => {
    const editor = realm.getValue(editorSearchActiveEditor$)
    const matches = realm.getValue(editorSearchStateMatches$)
    const match = matches[cursor - 1]
    if (!editor || !match) return

    replaceStateMatches(editor, [match], replacement, () => {
      refreshSearch(realm, editor, { cursor, match })
      onUpdate?.()
    })
  }

  const replaceAll = (replacement: string, onUpdate?: () => void) => {
    const editor = realm.getValue(editorSearchActiveEditor$)
    const matches = realm.getValue(editorSearchStateMatches$)
    if (!editor || matches.length === 0) return

    replaceStateMatches(editor, matches, replacement, () => {
      refreshSearch(realm, editor)
      onUpdate?.()
    })
  }

  return {
    next,
    prev,
    total: ranges.length,
    cursor,
    setSearch,
    search,
    currentRange,
    isSearchOpen,
    setIsSearchOpen,
    openSearch,
    closeSearch,
    toggleSearch,
    ranges,
    scrollToRangeOrIndex,
    replace,
    replaceAll
  }
}

export const searchPlugin = realmPlugin({
  init(realm) {
    if (!supportsHighlights()) {
      console.warn('CSS.highlights is not supported in this browser. Search highlighting will be unavailable.')
    }

    realm.sub(editorSearchCursor$, (cursor) => {
      if (realm.getValue(searchOpen$)) {
        focusHighlightRange(realm.getValue(editorSearchRanges$)[cursor - 1])
      }
    })

    realm.sub(editorSearchTerm$, () => {
      const editor = realm.getValue(editorSearchActiveEditor$)
      if (editor) refreshSearch(realm, editor)
    })

    realm.sub(searchOpen$, (searchOpen) => {
      if (!searchOpen) {
        clearSearchResults(realm)
        return
      }
      const editor = realm.getValue(editorSearchActiveEditor$)
      if (editor) refreshSearch(realm, editor)
    })

    realm.pub(createActiveEditorSubscription$, (editor) => {
      realm.pubIn({
        [editorSearchActiveEditor$]: editor,
        [editorSearchTextNodeIndex$]: EmptyTextNodeIndex,
        [editorSearchScrollableContent$]: editor.getRootElement()?.parentElement ?? null
      })
      clearSearchResults(realm)
      refreshSearch(realm, editor)

      const unregisterUpdate = editor.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
        if (dirtyElements.size > 0 || dirtyLeaves.size > 0) refreshSearch(realm, editor)
      })
      const unregisterRoot = editor.registerRootListener((rootElement) => {
        if (!rootElement) {
          if (realm.getValue(editorSearchActiveEditor$) === editor) {
            realm.pubIn({
              [editorSearchTextNodeIndex$]: EmptyTextNodeIndex,
              [editorSearchScrollableContent$]: null
            })
            clearSearchResults(realm)
          }
          return
        }

        realm.pub(editorSearchScrollableContent$, rootElement.parentElement)
        refreshSearch(realm, editor)
      })

      return () => {
        unregisterUpdate()
        unregisterRoot()
        if (realm.getValue(editorSearchActiveEditor$) === editor) {
          realm.pub(editorSearchActiveEditor$, null)
          clearSearchResults(realm)
        }
      }
    })

    realm.sub(activeEditor$, (editor) => {
      if (!editor) {
        realm.pub(editorSearchScrollableContent$, null)
        clearSearchResults(realm)
      }
    })
  }
})
