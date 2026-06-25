import {
  $createRangeSelection,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  COMMAND_PRIORITY_LOW,
  SELECTION_CHANGE_COMMAND,
  type ElementNode,
  type LexicalEditor,
  type LexicalNode,
  type TextNode
} from 'lexical'
import {
  $createMarkNode,
  $isMarkNode,
  $unwrapMarkNode,
  $wrapSelectionInMarkNode,
  type MarkNode
} from '@lexical/mark'
import { $isListItemNode } from '@lexical/list'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type {
  MarkdownAnnotation,
  MarkdownAnnotationAnchor,
  MarkdownAnnotationBlock,
  MarkdownAnnotationLayout,
  MarkdownAnnotationRect,
  MarkdownCommentTarget
} from './annotations'

const commentableTypes = new Set([
  'codeblock',
  'frontmatter',
  'heading',
  'horizontalrule',
  'image',
  'listitem',
  'paragraph',
  'quote',
  'table'
])

const preferredAncestorTypes = new Set([
  'codeblock',
  'frontmatter',
  'horizontalrule',
  'image',
  'listitem',
  'table'
])

const labelByType: Record<string, string> = {
  codeblock: 'Code block',
  frontmatter: 'Frontmatter',
  heading: 'Heading',
  horizontalrule: 'Divider',
  image: 'Image',
  listitem: 'List item',
  paragraph: 'Paragraph',
  quote: 'Quote',
  table: 'Table'
}

const hashText = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim()

const getCommentableType = (node: LexicalNode) =>
  $isListItemNode(node) ? 'listitem' : node.getType()

const isCommentableNode = (node: LexicalNode) =>
  commentableTypes.has(getCommentableType(node))

const getNodePath = (node: LexicalNode) => {
  const path: number[] = []
  let current: LexicalNode | null = node
  while (current && current.getKey() !== 'root') {
    path.push(current.getIndexWithinParent())
    current = current.getParent()
  }
  return path.reverse()
}

const getBlockSnapshot = (node: LexicalNode): MarkdownAnnotationBlock => {
  const text = normalizeText(node.getTextContent())
  return {
    fingerprint: hashText(`${getCommentableType(node)}\0${text}`),
    path: getNodePath(node),
    runtimeKey: node.getKey(),
    text,
    type: getCommentableType(node)
  }
}

const getCommentableNode = (node: LexicalNode | null) => {
  let current = node
  let fallback: LexicalNode | null = null
  while (current && current.getKey() !== 'root') {
    const type = getCommentableType(current)
    if (preferredAncestorTypes.has(type)) {
      return current
    }
    if (!fallback && commentableTypes.has(type)) {
      fallback = current
    }
    current = current.getParent()
  }
  return fallback
}

const visitNodes = (node: LexicalNode, callback: (node: LexicalNode) => void) => {
  callback(node)
  if ($isElementNode(node)) {
    for (const child of node.getChildren()) {
      visitNodes(child, callback)
    }
  }
}

const getNodeAtPath = (path: readonly number[]) => {
  let current: LexicalNode = $getRoot()
  for (const index of path) {
    if (!$isElementNode(current)) {
      return null
    }
    const child = current.getChildAtIndex(index)
    if (!child) {
      return null
    }
    current = child
  }
  return current
}

const getCommentableNodes = () => {
  const nodes: LexicalNode[] = []
  visitNodes($getRoot(), (node) => {
    if (isCommentableNode(node)) {
      nodes.push(node)
    }
  })
  return nodes
}

const scoreBlockCandidate = (
  candidate: MarkdownAnnotationBlock,
  anchor: MarkdownAnnotationAnchor
) => {
  let score = 0
  if (candidate.type === anchor.block.type) {
    score += 4
  }
  if (candidate.fingerprint === anchor.block.fingerprint) {
    score += 8
  }
  if (candidate.text === anchor.block.text) {
    score += 6
  } else if (
    anchor.block.text &&
    (candidate.text.includes(anchor.block.text) ||
      anchor.block.text.includes(candidate.text))
  ) {
    score += 2
  }
  const sharedPath = candidate.path.findIndex(
    (value, index) => value !== anchor.block.path[index]
  )
  score +=
    sharedPath === -1
      ? Math.min(candidate.path.length, anchor.block.path.length)
      : sharedPath
  return score
}

const resolveBlockNode = (anchor: MarkdownAnnotationAnchor) => {
  if (anchor.block.runtimeKey) {
    const runtimeNode = $getNodeByKey(anchor.block.runtimeKey)
    if (
      runtimeNode &&
      isCommentableNode(runtimeNode) &&
      getCommentableType(runtimeNode) === anchor.block.type
    ) {
      return runtimeNode
    }
  }

  const pathNode = getNodeAtPath(anchor.block.path)
  if (
    pathNode &&
    isCommentableNode(pathNode) &&
    getCommentableType(pathNode) === anchor.block.type
  ) {
    const snapshot = getBlockSnapshot(pathNode)
    if (
      snapshot.fingerprint === anchor.block.fingerprint ||
      snapshot.text === anchor.block.text
    ) {
      return pathNode
    }
  }

  const candidates = getCommentableNodes()
    .map((node) => ({
      node,
      score: scoreBlockCandidate(getBlockSnapshot(node), anchor)
    }))
    .sort((left, right) => right.score - left.score)
  if (
    candidates.length === 0 ||
    candidates[0].score < 6 ||
    candidates[0].score === candidates[1]?.score
  ) {
    return null
  }
  return candidates[0].node
}

const getTextNodes = (node: LexicalNode) => {
  const textNodes: TextNode[] = []
  visitNodes(node, (candidate) => {
    if ($isTextNode(candidate)) {
      textNodes.push(candidate)
    }
  })
  return textNodes
}

const getPointAtOffset = (
  textNodes: readonly TextNode[],
  requestedOffset: number,
  preferNext: boolean
) => {
  let offset = Math.max(0, requestedOffset)
  for (const textNode of textNodes) {
    const size = textNode.getTextContentSize()
    if (offset < size || (offset === size && !preferNext)) {
      return { key: textNode.getKey(), offset, type: 'text' as const }
    }
    offset -= size
  }
  const finalNode = textNodes.at(-1)
  return finalNode
    ? {
        key: finalNode.getKey(),
        offset: finalNode.getTextContentSize(),
        type: 'text' as const
      }
    : null
}

const findQuoteRange = (text: string, anchor: MarkdownAnnotationAnchor) => {
  const quote = anchor.quote
  if (!quote?.exact) {
    return null
  }
  if (text.slice(quote.start, quote.end) === quote.exact) {
    return { end: quote.end, start: quote.start }
  }

  const matches: number[] = []
  let index = text.indexOf(quote.exact)
  while (index !== -1) {
    const prefix = text.slice(Math.max(0, index - quote.prefix.length), index)
    const suffix = text.slice(
      index + quote.exact.length,
      index + quote.exact.length + quote.suffix.length
    )
    if (
      (!quote.prefix || prefix === quote.prefix) &&
      (!quote.suffix || suffix === quote.suffix)
    ) {
      matches.push(index)
    }
    index = text.indexOf(quote.exact, index + 1)
  }
  return matches.length === 1
    ? { end: matches[0] + quote.exact.length, start: matches[0] }
    : null
}

const getOffsetWithinBlock = (block: LexicalNode, target: TextNode, offset: number) => {
  let total = 0
  for (const textNode of getTextNodes(block)) {
    if (textNode.is(target)) {
      return total + offset
    }
    total += textNode.getTextContentSize()
  }
  return total
}

const buildSelectionAnchor = (): MarkdownAnnotationAnchor | null => {
  const selection = $getSelection()
  if (!$isRangeSelection(selection) || selection.isCollapsed()) {
    return null
  }
  const [startPoint, endPoint] = selection.isBackward()
    ? [selection.focus, selection.anchor]
    : [selection.anchor, selection.focus]
  const startNode = startPoint.getNode()
  const endNode = endPoint.getNode()
  const startBlock = getCommentableNode(startNode)
  const endBlock = getCommentableNode(endNode)
  if (
    !startBlock ||
    !endBlock ||
    !startBlock.is(endBlock) ||
    !$isTextNode(startNode) ||
    !$isTextNode(endNode)
  ) {
    return null
  }

  const blockText = startBlock.getTextContent()
  const start = getOffsetWithinBlock(startBlock, startNode, startPoint.offset)
  const end = getOffsetWithinBlock(startBlock, endNode, endPoint.offset)
  const exact = blockText.slice(start, end)
  if (!exact) {
    return null
  }

  return {
    block: getBlockSnapshot(startBlock),
    kind: 'text',
    quote: {
      end,
      exact,
      prefix: blockText.slice(Math.max(0, start - 32), start),
      start,
      suffix: blockText.slice(end, end + 32)
    },
    version: 1
  }
}

const buildBlockAnchor = (runtimeKey?: string): MarkdownAnnotationAnchor | null => {
  const selection = $getSelection()
  const selectedNode =
    runtimeKey != null
      ? $getNodeByKey(runtimeKey)
      : $isRangeSelection(selection)
        ? selection.anchor.getNode()
        : null
  const block = getCommentableNode(selectedNode)
  return block
    ? {
        block: getBlockSnapshot(block),
        kind: 'block',
        version: 1
      }
    : null
}

const getMarkNodes = (id: string) => {
  const marks: MarkNode[] = []
  visitNodes($getRoot(), (node) => {
    if ($isMarkNode(node) && node.hasID(id)) {
      marks.push(node)
    }
  })
  return marks
}

const markSelection = (id: string) => {
  const selection = $getSelection()
  if (!$isRangeSelection(selection) || selection.isCollapsed()) {
    return
  }
  $wrapSelectionInMarkNode(selection, selection.isBackward(), id, (ids) =>
    $createMarkNode(ids)
  )
}

const restoreTextAnnotation = (
  id: string,
  anchor: MarkdownAnnotationAnchor
) => {
  if (getMarkNodes(id).length > 0) {
    return true
  }
  const block = resolveBlockNode(anchor)
  if (!block) {
    return false
  }
  const range = findQuoteRange(block.getTextContent(), anchor)
  const textNodes = getTextNodes(block)
  if (!range || textNodes.length === 0) {
    return false
  }
  const start = getPointAtOffset(textNodes, range.start, true)
  const end = getPointAtOffset(textNodes, range.end, false)
  if (!start || !end) {
    return false
  }
  const selection = $createRangeSelection()
  const previousSelection = $getSelection()?.clone() ?? null
  selection.anchor.set(start.key, start.offset, start.type)
  selection.focus.set(end.key, end.offset, end.type)
  $setSelection(selection)
  markSelection(id)
  $setSelection(previousSelection)
  return true
}

const getTextAnchorFromMarks = (
  id: string,
  fallback: MarkdownAnnotationAnchor
) => {
  const marks = getMarkNodes(id)
  if (marks.length === 0) {
    return null
  }
  const firstText = marks[0].getFirstDescendant()
  const finalText = marks.at(-1)?.getLastDescendant()
  if (!$isTextNode(firstText) || !$isTextNode(finalText)) {
    return null
  }
  const block = getCommentableNode(firstText)
  if (!block || !block.is(getCommentableNode(finalText))) {
    return null
  }
  const blockText = block.getTextContent()
  const start = getOffsetWithinBlock(block, firstText, 0)
  const end = getOffsetWithinBlock(
    block,
    finalText,
    finalText.getTextContentSize()
  )
  const exact = blockText.slice(start, end)
  return {
    block: getBlockSnapshot(block),
    kind: 'text' as const,
    quote: {
      end,
      exact,
      prefix: blockText.slice(Math.max(0, start - 32), start),
      start,
      suffix: blockText.slice(end, end + 32)
    },
    version: fallback.version
  }
}

const toRect = (rect: DOMRect): MarkdownAnnotationRect => ({
  height: rect.height,
  left: rect.left,
  top: rect.top,
  width: rect.width
})

const unionRects = (rects: readonly DOMRect[]) => {
  if (rects.length === 0) {
    return undefined
  }
  const left = Math.min(...rects.map((rect) => rect.left))
  const top = Math.min(...rects.map((rect) => rect.top))
  const right = Math.max(...rects.map((rect) => rect.right))
  const bottom = Math.max(...rects.map((rect) => rect.bottom))
  return { height: bottom - top, left, top, width: right - left }
}

const getBlockElement = (editor: LexicalEditor, runtimeKey?: string) =>
  runtimeKey ? editor.getElementByKey(runtimeKey) : null

export type MarkdownAnnotationController = {
  createAnnotation: (
    id: string,
    target?: MarkdownCommentTarget | null
  ) => MarkdownAnnotationAnchor | null
  focusAnnotation: (id: string) => void
  getAnnotationAnchor: (id: string) => MarkdownAnnotationAnchor | null
  reconcileAnnotations: () => void
  removeAnnotation: (id: string) => void
}

export function AnnotationController({
  activeAnnotationId,
  annotations,
  controllerRef,
  onAnnotationAnchorChange,
  onAnnotationLayoutChange,
  onCommentTargetChange
}: {
  activeAnnotationId?: string | null
  annotations: readonly MarkdownAnnotation[]
  controllerRef: React.MutableRefObject<MarkdownAnnotationController | null>
  onAnnotationAnchorChange?: (
    id: string,
    anchor: MarkdownAnnotationAnchor | null
  ) => void
  onAnnotationLayoutChange?: (
    layouts: readonly MarkdownAnnotationLayout[]
  ) => void
  onCommentTargetChange?: (target: MarkdownCommentTarget | null) => void
}) {
  const [editor] = useLexicalComposerContext()
  const annotationsRef = useRef(annotations)
  const annotationSignature = useMemo(
    () => JSON.stringify(annotations),
    [annotations]
  )
  const blockKeysRef = useRef(new Map<string, string>())
  const detachedRef = useRef(new Set<string>())
  const hoverKeyRef = useRef<string | null>(null)
  const callbacksRef = useRef({
    onAnnotationAnchorChange,
    onAnnotationLayoutChange,
    onCommentTargetChange
  })
  annotationsRef.current = annotations
  callbacksRef.current = {
    onAnnotationAnchorChange,
    onAnnotationLayoutChange,
    onCommentTargetChange
  }

  const updateDOMMetadata = () => {
    const rootElement = editor.getRootElement()
    if (!rootElement) {
      return
    }
    rootElement
      .querySelectorAll<HTMLElement>('[data-mdx-comment-block]')
      .forEach((element) => {
        element.removeAttribute('data-mdx-comment-block')
        element.removeAttribute('data-mdx-comment-block-key')
        element.removeAttribute('data-mdx-comment-block-type')
        element.removeAttribute('data-mdx-annotation-block')
        element.removeAttribute('data-mdx-annotation-active')
      })
    rootElement
      .querySelectorAll<HTMLElement>('mark[data-mdx-annotation-ids]')
      .forEach((element) => {
        element.removeAttribute('data-mdx-annotation-ids')
        element.removeAttribute('data-mdx-annotation-active')
      })

    editor.getEditorState().read(() => {
      for (const node of getCommentableNodes()) {
        const element = editor.getElementByKey(node.getKey())
        if (element) {
          element.dataset.mdxCommentBlock = ''
          element.dataset.mdxCommentBlockKey = node.getKey()
          element.dataset.mdxCommentBlockType = getCommentableType(node)
        }
      }
      const blockAnnotationIds = new Map<string, string[]>()
      for (const [id, key] of blockKeysRef.current) {
        const ids = blockAnnotationIds.get(key) ?? []
        ids.push(id)
        blockAnnotationIds.set(key, ids)
      }
      for (const [key, ids] of blockAnnotationIds) {
        const element = editor.getElementByKey(key)
        if (element) {
          element.dataset.mdxAnnotationBlock = ids.join(' ')
          if (activeAnnotationId && ids.includes(activeAnnotationId)) {
            element.dataset.mdxAnnotationActive = ''
          }
        }
      }
      visitNodes($getRoot(), (node) => {
        if (!$isMarkNode(node)) {
          return
        }
        const element = editor.getElementByKey(node.getKey())
        if (element) {
          const ids = node.getIDs()
          element.dataset.mdxAnnotationIds = ids.join(' ')
          if (activeAnnotationId && ids.includes(activeAnnotationId)) {
            element.dataset.mdxAnnotationActive = ''
          }
        }
      })
    })
  }

  const publishLayouts = () => {
    const layouts: MarkdownAnnotationLayout[] = []
    editor.getEditorState().read(() => {
      for (const annotation of annotationsRef.current) {
        if (annotation.anchor.kind === 'text') {
          const rects = getMarkNodes(annotation.id)
            .map((mark) => editor.getElementByKey(mark.getKey()))
            .filter((element): element is HTMLElement => element != null)
            .map((element) => element.getBoundingClientRect())
          const rect = unionRects(rects)
          layouts.push({
            detached: !rect,
            id: annotation.id,
            ...(rect ? { rect } : {})
          })
        } else {
          const element = getBlockElement(
            editor,
            blockKeysRef.current.get(annotation.id)
          )
          layouts.push({
            detached: !element,
            id: annotation.id,
            ...(element ? { rect: toRect(element.getBoundingClientRect()) } : {})
          })
        }
      }
    })
    callbacksRef.current.onAnnotationLayoutChange?.(layouts)
  }

  const publishCommentTarget = () => {
    const selection = document.getSelection()
    if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
      let anchor: MarkdownAnnotationAnchor | null = null
      editor.getEditorState().read(() => {
        anchor = buildSelectionAnchor()
      })
      if (anchor) {
        callbacksRef.current.onCommentTargetChange?.({
          anchor,
          label: 'Selection',
          rect: toRect(selection.getRangeAt(0).getBoundingClientRect())
        })
        return
      }
    }

    const key = hoverKeyRef.current
    const element = key ? editor.getElementByKey(key) : null
    if (!key || !element) {
      callbacksRef.current.onCommentTargetChange?.(null)
      return
    }
    const anchor = editor
      .getEditorState()
      .read(() => buildBlockAnchor(key))
    callbacksRef.current.onCommentTargetChange?.(
      anchor
        ? {
            anchor,
            label:
              labelByType[anchor.block.type] ??
              labelByType[element.dataset.mdxCommentBlockType ?? ''] ??
              'Block',
            rect: toRect(element.getBoundingClientRect())
          }
        : null
    )
  }

  const reconcileAnnotations = () => {
    const knownIds = new Set(annotationsRef.current.map(({ id }) => id))
    for (const id of blockKeysRef.current.keys()) {
      if (!knownIds.has(id)) {
        blockKeysRef.current.delete(id)
      }
    }

    editor.update(
      () => {
        for (const annotation of annotationsRef.current) {
          let resolved = false
          if (annotation.anchor.kind === 'text') {
            resolved = restoreTextAnnotation(annotation.id, annotation.anchor)
          } else {
            const block = resolveBlockNode(annotation.anchor)
            if (block) {
              blockKeysRef.current.set(annotation.id, block.getKey())
              resolved = true
            }
          }
          if (!resolved) {
            if (!detachedRef.current.has(annotation.id)) {
              detachedRef.current.add(annotation.id)
              callbacksRef.current.onAnnotationAnchorChange?.(
                annotation.id,
                null
              )
            }
          } else {
            detachedRef.current.delete(annotation.id)
          }
        }
      },
      { tag: 'mdx-editor-annotations' }
    )
    requestAnimationFrame(() => {
      updateDOMMetadata()
      publishLayouts()
    })
  }

  useLayoutEffect(reconcileAnnotations, [annotationSignature, editor])

  useEffect(() => {
    const removeUpdateListener = editor.registerUpdateListener(
      ({ tags }) => {
        if (!tags.has('mdx-editor-annotations')) {
          editor.getEditorState().read(() => {
            for (const annotation of annotationsRef.current) {
              const nextAnchor =
                annotation.anchor.kind === 'text'
                  ? getTextAnchorFromMarks(annotation.id, annotation.anchor)
                  : (() => {
                      const block = $getNodeByKey(
                        blockKeysRef.current.get(annotation.id) ?? ''
                      )
                      return block
                        ? {
                            block: getBlockSnapshot(block),
                            kind: 'block' as const,
                            version: annotation.anchor.version
                          }
                        : null
                    })()
              if (
                nextAnchor &&
                JSON.stringify(nextAnchor) !== JSON.stringify(annotation.anchor)
              ) {
                callbacksRef.current.onAnnotationAnchorChange?.(
                  annotation.id,
                  nextAnchor
                )
              }
            }
          })
        }
        requestAnimationFrame(() => {
          updateDOMMetadata()
          publishLayouts()
        })
      }
    )
    const removeSelectionListener = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        requestAnimationFrame(publishCommentTarget)
        return false
      },
      COMMAND_PRIORITY_LOW
    )
    return () => {
      removeSelectionListener()
      removeUpdateListener()
    }
  }, [editor])

  useEffect(() => {
    const rootElement = editor.getRootElement()
    if (!rootElement) {
      return
    }
    const handlePointerMove = (event: PointerEvent) => {
      const selection = document.getSelection()
      if (selection && !selection.isCollapsed) {
        return
      }
      const element = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        '[data-mdx-comment-block]'
      )
      const key = element?.dataset.mdxCommentBlockKey ?? null
      if (!key) {
        return
      }
      if (key === hoverKeyRef.current) {
        return
      }
      hoverKeyRef.current = key
      publishCommentTarget()
    }
    const handlePointerLeave = (event: PointerEvent) => {
      if (
        (event.relatedTarget as HTMLElement | null)?.closest?.(
          '[data-mdx-comment-button]'
        )
      ) {
        return
      }
      hoverKeyRef.current = null
      callbacksRef.current.onCommentTargetChange?.(null)
    }
    rootElement.addEventListener('pointermove', handlePointerMove)
    rootElement.addEventListener('pointerleave', handlePointerLeave)
    return () => {
      rootElement.removeEventListener('pointermove', handlePointerMove)
      rootElement.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [editor])

  useEffect(() => {
    const update = () => {
      publishLayouts()
      publishCommentTarget()
    }
    const root = editor.getRootElement()
    const observer =
      root && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(update)
        : null
    if (root) {
      observer?.observe(root)
    }
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [editor])

  useEffect(() => {
    requestAnimationFrame(() => {
      updateDOMMetadata()
      publishLayouts()
    })
  }, [activeAnnotationId])

  controllerRef.current = {
    createAnnotation(id, target) {
      let anchor: MarkdownAnnotationAnchor | null = null
      editor.update(
        () => {
          anchor =
            target?.anchor.kind === 'text'
              ? buildSelectionAnchor() ?? target.anchor
              : target?.anchor ??
                buildSelectionAnchor() ??
                buildBlockAnchor()
          if (!anchor) {
            return
          }
          if (anchor.kind === 'text') {
            if (!buildSelectionAnchor()) {
              restoreTextAnnotation(id, anchor)
            } else {
              markSelection(id)
            }
          } else {
            const block = resolveBlockNode(anchor)
            if (block) {
              blockKeysRef.current.set(id, block.getKey())
            }
          }
        },
        { tag: 'mdx-editor-annotations' }
      )
      requestAnimationFrame(() => {
        updateDOMMetadata()
        publishLayouts()
      })
      return anchor
    },
    focusAnnotation(id) {
      const element = editor.getEditorState().read(
        () =>
          getMarkNodes(id)
            .map((mark) => editor.getElementByKey(mark.getKey()))
            .find(Boolean) ??
          getBlockElement(editor, blockKeysRef.current.get(id))
      )
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    },
    getAnnotationAnchor(id) {
      let anchor: MarkdownAnnotationAnchor | null = null
      editor.getEditorState().read(() => {
        const annotation = annotationsRef.current.find(
          (candidate) => candidate.id === id
        )
        if (!annotation) {
          return
        }
        anchor =
          annotation.anchor.kind === 'text'
            ? getTextAnchorFromMarks(id, annotation.anchor)
            : (() => {
                const block = $getNodeByKey(
                  blockKeysRef.current.get(id) ?? ''
                )
                return block
                  ? {
                      block: getBlockSnapshot(block),
                      kind: 'block',
                      version: 1
                    }
                  : null
              })()
      })
      return anchor
    },
    reconcileAnnotations,
    removeAnnotation(id) {
      editor.update(
        () => {
          for (const mark of getMarkNodes(id)) {
            if (mark.getIDs().length > 1) {
              mark.deleteID(id)
            } else {
              $unwrapMarkNode(mark)
            }
          }
          blockKeysRef.current.delete(id)
        },
        { tag: 'mdx-editor-annotations' }
      )
      requestAnimationFrame(() => {
        updateDOMMetadata()
        publishLayouts()
      })
    }
  }

  useEffect(
    () => () => {
      controllerRef.current = null
    },
    [controllerRef]
  )

  return null
}
