/**
 * Adapted from Lexical's checklist implementation.
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 * Licensed under the MIT license.
 */

import type { ListItemNode } from '@lexical/list'
import type { LexicalEditor } from 'lexical'

import {
  $insertList,
  $isListItemNode,
  $isListNode,
  INSERT_CHECK_LIST_COMMAND
} from '@lexical/list'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $findMatchingParent,
  calculateZoomLevel,
  isHTMLElement,
  mergeRegister
} from '@lexical/utils'
import {
  $addUpdateTag,
  $getNearestNodeFromDOMNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  getNearestEditorFromDOMNode,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_SPACE_COMMAND,
  SKIP_DOM_SELECTION_TAG,
  SKIP_SELECTION_FOCUS_TAG
} from 'lexical'
import { useEffect } from 'react'

const TOUCH_CLICK_DEDUP_WINDOW_MS = 500
const lastTouchToggleByTarget = new WeakMap<HTMLElement, number>()

export function CheckListPlugin({
  disableTakeFocusOnClick = false
}: {
  disableTakeFocusOnClick?: boolean
}): null {
  const [editor] = useLexicalComposerContext()

  useEffect(
    () => registerCheckList(editor, disableTakeFocusOnClick),
    [editor, disableTakeFocusOnClick]
  )

  return null
}

function registerCheckList(
  editor: LexicalEditor,
  disableTakeFocusOnClick: boolean
) {
  const handleMouseClick = (event: MouseEvent) => {
    const target = event.target

    if (isHTMLElement(target)) {
      const lastTouchToggle = lastTouchToggleByTarget.get(target)
      lastTouchToggleByTarget.delete(target)

      if (
        lastTouchToggle !== undefined &&
        performance.now() - lastTouchToggle < TOUCH_CLICK_DEDUP_WINDOW_MS
      ) {
        return
      }
    }

    handleClick(event, disableTakeFocusOnClick)
  }

  const handlePointerUp = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') {
      return
    }

    if (handleClick(event, disableTakeFocusOnClick) && isHTMLElement(event.target)) {
      lastTouchToggleByTarget.set(event.target, performance.now())
    }
  }

  const handleSelect = (
    event: PointerEvent | MouseEvent | TouchEvent
  ) => {
    handleSelectDefaults(event, disableTakeFocusOnClick)
  }

  return mergeRegister(
    editor.registerCommand(
      INSERT_CHECK_LIST_COMMAND,
      () => {
        $insertList('check')
        return true
      },
      COMMAND_PRIORITY_LOW
    ),
    editor.registerCommand<KeyboardEvent>(
      KEY_ARROW_DOWN_COMMAND,
      (event) => handleArrowUpOrDown(event, editor, false),
      COMMAND_PRIORITY_LOW
    ),
    editor.registerCommand<KeyboardEvent>(
      KEY_ARROW_UP_COMMAND,
      (event) => handleArrowUpOrDown(event, editor, true),
      COMMAND_PRIORITY_LOW
    ),
    editor.registerCommand<KeyboardEvent>(
      KEY_ESCAPE_COMMAND,
      () => {
        const activeItem = getActiveCheckListItem()

        if (activeItem === null) {
          return false
        }

        editor.getRootElement()?.focus()
        return true
      },
      COMMAND_PRIORITY_LOW
    ),
    editor.registerCommand<KeyboardEvent>(
      KEY_SPACE_COMMAND,
      (event) => {
        const activeItem = getActiveCheckListItem()

        if (activeItem === null || !editor.isEditable()) {
          return false
        }

        editor.update(() => {
          const listItemNode = $getNearestNodeFromDOMNode(activeItem)

          if ($isListItemNode(listItemNode)) {
            event.preventDefault()
            listItemNode.toggleChecked()
          }
        })
        return true
      },
      COMMAND_PRIORITY_LOW
    ),
    editor.registerCommand<KeyboardEvent>(
      KEY_ARROW_LEFT_COMMAND,
      (event) =>
        editor.getEditorState().read(() => {
          const selection = $getSelection()

          if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
            return false
          }

          const { anchor } = selection
          const isElement = anchor.type === 'element'

          if (!isElement && anchor.offset !== 0) {
            return false
          }

          const anchorNode = anchor.getNode()
          const elementNode = $findMatchingParent(
            anchorNode,
            (node) => $isElementNode(node) && !node.isInline()
          )

          if (!$isListItemNode(elementNode)) {
            return false
          }

          const parent = elementNode.getParent()
          if (
            !$isListNode(parent) ||
            parent.getListType() !== 'check' ||
            (!isElement && elementNode.getFirstDescendant() !== anchorNode)
          ) {
            return false
          }

          const domNode = editor.getElementByKey(elementNode.getKey())
          if (domNode === null || document.activeElement === domNode) {
            return false
          }

          domNode.focus()
          event.preventDefault()
          return true
        }),
      COMMAND_PRIORITY_LOW
    ),
    editor.registerRootListener((rootElement) => {
      if (rootElement === null) {
        return
      }

      rootElement.addEventListener('click', handleMouseClick)
      rootElement.addEventListener('pointerup', handlePointerUp)
      rootElement.addEventListener('pointerdown', handleSelect, {
        capture: true
      })
      rootElement.addEventListener('mousedown', handleSelect, {
        capture: true
      })
      rootElement.addEventListener('touchstart', handleSelect, {
        capture: true,
        passive: false
      })

      return () => {
        rootElement.removeEventListener('click', handleMouseClick)
        rootElement.removeEventListener('pointerup', handlePointerUp)
        rootElement.removeEventListener('pointerdown', handleSelect, {
          capture: true
        })
        rootElement.removeEventListener('mousedown', handleSelect, {
          capture: true
        })
        rootElement.removeEventListener('touchstart', handleSelect, {
          capture: true
        })
      }
    })
  )
}

function handleCheckItemEvent(
  event: PointerEvent | MouseEvent | TouchEvent,
  callback: () => boolean | void
): boolean {
  const target = event.target

  if (!isHTMLElement(target)) {
    return false
  }

  const firstChild = target.firstChild
  if (
    isHTMLElement(firstChild) &&
    (firstChild.tagName === 'UL' || firstChild.tagName === 'OL')
  ) {
    return false
  }

  const parentNode = target.parentNode
  // Lexical stores the rendered list type on the DOM list node.
  if (
    !parentNode ||
    (parentNode as HTMLElement & { __lexicalListType?: string })
      .__lexicalListType !== 'check'
  ) {
    return false
  }

  let clientX: number | null = null
  let pointerType: string | null = null

  if ('clientX' in event) {
    clientX = event.clientX
  } else if ('touches' in event && event.touches.length > 0) {
    clientX = event.touches[0]!.clientX
    pointerType = 'touch'
  }

  if (clientX === null) {
    return false
  }

  const rect = target.getBoundingClientRect()
  const clientXInPixels = clientX / calculateZoomLevel(target)
  const beforeStyles = window.getComputedStyle
    ? window.getComputedStyle(target, '::before')
    : ({ width: '0px' } as CSSStyleDeclaration)
  const beforeWidthInPixels = parseFloat(beforeStyles.width)
  const isTouchEvent =
    pointerType === 'touch' ||
    ('pointerType' in event && event.pointerType === 'touch')
  const clickAreaPadding = isTouchEvent ? 32 : 0
  const isMarkerHit =
    target.dir === 'rtl'
      ? clientXInPixels < rect.right + clickAreaPadding &&
        clientXInPixels >
          rect.right - beforeWidthInPixels - clickAreaPadding
      : clientXInPixels > rect.left - clickAreaPadding &&
        clientXInPixels <
          rect.left + beforeWidthInPixels + clickAreaPadding

  if (!isMarkerHit) {
    return false
  }

  return callback() !== false
}

function handleClick(
  event: PointerEvent | MouseEvent | TouchEvent,
  disableFocusOnClick: boolean
): boolean {
  return handleCheckItemEvent(event, () => {
    if (!isHTMLElement(event.target)) {
      return false
    }

    const domNode = event.target
    const editor = getNearestEditorFromDOMNode(domNode)
    if (editor === null || !editor.isEditable()) {
      return false
    }

    editor.update(() => {
      const node = $getNearestNodeFromDOMNode(domNode)

      if ($isListItemNode(node)) {
        if (disableFocusOnClick) {
          $addUpdateTag(SKIP_SELECTION_FOCUS_TAG)
          $addUpdateTag(SKIP_DOM_SELECTION_TAG)
        } else {
          domNode.focus()
        }
        node.toggleChecked()
      }
    })

    return true
  })
}

function handleSelectDefaults(
  event: PointerEvent | MouseEvent | TouchEvent,
  disableTakeFocusOnClick: boolean
) {
  handleCheckItemEvent(event, () => {
    event.preventDefault()
    if (disableTakeFocusOnClick) {
      event.stopPropagation()
    }
  })
}

function getActiveCheckListItem(): HTMLElement | null {
  const activeElement = document.activeElement

  return isHTMLElement(activeElement) &&
    activeElement.tagName === 'LI' &&
    activeElement.parentNode !== null &&
    (
      activeElement.parentNode as HTMLElement & {
        __lexicalListType?: string
      }
    ).__lexicalListType === 'check'
    ? activeElement
    : null
}

function findCheckListItemSibling(
  node: ListItemNode,
  backward: boolean
): ListItemNode | null {
  let sibling = backward
    ? node.getPreviousSibling()
    : node.getNextSibling()
  let parent: ListItemNode | null = node

  while (sibling === null && $isListItemNode(parent)) {
    parent = parent.getParentOrThrow().getParent()
    if (parent !== null) {
      sibling = backward
        ? parent.getPreviousSibling()
        : parent.getNextSibling()
    }
  }

  while ($isListItemNode(sibling)) {
    const firstChild = backward
      ? sibling.getLastChild()
      : sibling.getFirstChild()

    if (!$isListNode(firstChild)) {
      return sibling
    }

    sibling = backward
      ? firstChild.getLastChild()
      : firstChild.getFirstChild()
  }

  return null
}

function handleArrowUpOrDown(
  event: KeyboardEvent,
  editor: LexicalEditor,
  backward: boolean
) {
  const activeItem = getActiveCheckListItem()

  if (activeItem !== null) {
    editor.update(() => {
      const listItem = $getNearestNodeFromDOMNode(activeItem)
      if (!$isListItemNode(listItem)) {
        return
      }

      const nextListItem = findCheckListItemSibling(listItem, backward)
      if (nextListItem !== null) {
        nextListItem.selectStart()
        const dom = editor.getElementByKey(nextListItem.getKey())

        if (dom !== null) {
          event.preventDefault()
          setTimeout(() => dom.focus(), 0)
        }
      }
    })
  }

  return false
}
