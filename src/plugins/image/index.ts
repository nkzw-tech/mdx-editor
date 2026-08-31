/* eslint-disable @typescript-eslint/no-deprecated */
import { ImagePlaceholder } from './ImagePlaceholder.js'
import { $wrapNodeInElement, mergeRegister } from '@lexical/utils'
import React, { JSX } from 'react'
import { Action, Cell, Realm, Signal, map, mapTo, useCellValues, usePublisher, withLatestFrom } from '@mdxeditor/gurx'
import {
  $createParagraphNode,
  $createRangeSelection,
  $getNodeByKey,
  $getSelection,
  $insertNodes,
  $isNodeSelection,
  $isRootOrShadowRoot,
  $setSelection,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  DRAGOVER_COMMAND,
  DRAGSTART_COMMAND,
  DROP_COMMAND,
  LexicalCommand,
  LexicalEditor,
  PASTE_COMMAND,
  type PasteCommandType,
  createCommand
} from 'lexical'
import { realmPlugin } from '../../RealmWithPlugins.js'
import { CAN_USE_DOM } from '../../utils/detectMac.js'
import {
  activeEditor$,
  addComposerChild$,
  addExportVisitor$,
  addImportVisitor$,
  addLexicalNode$,
  createActiveEditorSubscription$,
  editorRootElementRef$,
  readOnly$
} from '../core/index.js'
import { EditImageToolbar, EditImageToolbarProps } from './EditImageToolbar.js'
import { ImageDialog } from './ImageDialog.js'
import { $createImageNode, $isImageNode, CreateImageNodeParameters, ImageNode } from './ImageNode.js'
import { LexicalImageVisitor } from './LexicalImageVisitor.js'
import { MdastHtmlImageVisitor, MdastImageVisitor, MdastJsxImageVisitor } from './MdastImageVisitor.js'
import styles from '../../styles/ui.module.css'

export * from './ImageNode.js'

/**
 * @group Image
 */
export type ImageUploadHandler = ((image: File) => Promise<string>) | null

/**
 * @group Image
 */
export type ImagePreviewHandler = ((imageSource: string) => Promise<string>) | null

interface BaseImageParameters {
  altText?: string
  title?: string
  width?: number
  height?: number
}

/**
 * @group Image
 */
export interface FileImageParameters extends BaseImageParameters {
  file: File
}

/**
 * @group Image
 */
export interface SrcImageParameters extends BaseImageParameters {
  src: string
}
/**
 * @group Image
 */
export type InsertImageParameters = FileImageParameters | SrcImageParameters

/**
 * @group Image
 */
export interface SaveImageParameters extends BaseImageParameters {
  src?: string
  file?: FileList
}

/**
 * The state of the image dialog when it is inactive.
 * @group Image
 */
export interface InactiveImageDialogState {
  type: 'inactive'
}

/**
 * The state of the image dialog when it is in new mode.
 * @group Image
 */
export interface NewImageDialogState {
  type: 'new'
}

/**
 * The state of the image dialog when it is in editing an existing node.
 * @group Image
 */
export interface EditingImageDialogState {
  type: 'editing'
  nodeKey: string
  initialValues: Omit<SaveImageParameters, 'file'>
}

const internalInsertImage$ = Signal<SrcImageParameters>((r) => {
  r.sub(r.pipe(internalInsertImage$, withLatestFrom(activeEditor$)), ([values, theEditor]) => {
    theEditor?.update(() => {
      const imageNode = $createImageNode({
        altText: values.altText ?? '',
        src: values.src,
        title: values.title ?? '',
        width: parseImageDimension(values.width),
        height: parseImageDimension(values.height)
      })
      $insertNodes([imageNode])
      if ($isRootOrShadowRoot(imageNode.getParentOrThrow())) {
        $wrapNodeInElement(imageNode, $createParagraphNode).selectEnd()
      }
    })
  })
})

/**
 * A signal that inserts a new image node with the published payload.
 * @group Image
 */
export const insertImage$ = Signal<InsertImageParameters>((r) => {
  r.sub(r.pipe(insertImage$, withLatestFrom(imageUploadHandler$)), ([values, imageUploadHandler]) => {
    const handler = (src: string) => {
      r.pub(internalInsertImage$, { ...values, src })
    }

    if ('file' in values) {
      if (imageUploadHandler) {
        uploadImage(r, imageUploadHandler, values.file)
          .then(handler)
          .catch((e: unknown) => {
            throw e
          })
      }
    } else {
      handler(values.src)
    }
  })
})
/**
 * Holds the autocomplete suggestions for image sources.
 * @group Image
 */
export const imageAutocompleteSuggestions$ = Cell<string[]>([])

/**
 * Holds the disable image resize configuration flag.
 * @group Image
 */
export const disableImageResize$ = Cell<boolean>(false)

/**
 * Holds the image upload handler callback.
 * @group Image
 */
export const imageUploadHandler$ = Cell<ImageUploadHandler>(null)

/**
 * Holds the image preview handler callback.
 * @group Image
 */
export const imagePreviewHandler$ = Cell<ImagePreviewHandler>(null)

/**
 * Holds the image placeholder.
 * @group Image
 */
export const imagePlaceholder$ = Cell<typeof ImagePlaceholder | null>(null)

/**
 * Tracks active image uploads.
 * @group Image
 */
export const imageUploadCount$ = Cell<number>(0)

/**
 * Tracks whether the editor is a file drop target for an image upload.
 * @group Image
 */
export const imageDragOver$ = Cell<boolean>(false)

const imageUploadPreviousReadOnly$ = Cell<boolean | null>(null)

const beginImageUpload = (r: Realm) => {
  const uploadCount = r.getValue(imageUploadCount$)
  if (uploadCount === 0) {
    r.pub(imageUploadPreviousReadOnly$, r.getValue(readOnly$))
    r.pub(readOnly$, true)
  }
  r.pub(imageDragOver$, false)
  r.pub(imageUploadCount$, uploadCount + 1)
}

const finishImageUpload = (r: Realm) => {
  const uploadCount = Math.max(0, r.getValue(imageUploadCount$) - 1)
  r.pub(imageUploadCount$, uploadCount)
  if (uploadCount === 0) {
    const previousReadOnly = r.getValue(imageUploadPreviousReadOnly$)
    r.pub(readOnly$, previousReadOnly ?? false)
    r.pub(imageUploadPreviousReadOnly$, null)
  }
}

const uploadImage = (r: Realm, imageUploadHandler: NonNullable<ImageUploadHandler>, file: File) => {
  beginImageUpload(r)
  return imageUploadHandler(file).finally(() => finishImageUpload(r))
}

const ImageUploadOverlay: React.FC = () => {
  const [uploadCount, imageDragOver, editorRootElementRef] = useCellValues(
    imageUploadCount$,
    imageDragOver$,
    editorRootElementRef$
  )
  const setImageDragOver = usePublisher(imageDragOver$)

  React.useEffect(() => {
    const editorRootElement = editorRootElementRef?.current
    if (!editorRootElement || typeof window === 'undefined') {
      return
    }

    const clearDragOver = () => setImageDragOver(false)
    const handleDragLeave = (event: DragEvent) => {
      const relatedTarget = event.relatedTarget
      if (relatedTarget instanceof Node && editorRootElement.contains(relatedTarget)) {
        return
      }
      clearDragOver()
    }

    editorRootElement.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('dragend', clearDragOver)
    window.addEventListener('drop', clearDragOver)
    return () => {
      editorRootElement.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('dragend', clearDragOver)
      window.removeEventListener('drop', clearDragOver)
    }
  }, [editorRootElementRef, setImageDragOver])

  if (uploadCount <= 0 && !imageDragOver) {
    return null
  }

  const uploading = uploadCount > 0
  return React.createElement(
    'div',
    {
      className: styles.imageUploadOverlay,
      'data-drop': !uploading && imageDragOver ? 'true' : undefined,
      role: 'status',
      style: !uploading && imageDragOver ? { pointerEvents: 'none' } : undefined
    },
    uploading ? 'Thinking…' : 'Drop images or videos'
  )
}

/**
 * Holds the current state of the image dialog.
 * @group Image
 */
export const imageDialogState$ = Cell<InactiveImageDialogState | NewImageDialogState | EditingImageDialogState>(
  { type: 'inactive' },
  (r) => {
    r.sub(
      r.pipe(saveImage$, withLatestFrom(activeEditor$, imageUploadHandler$, imageDialogState$, allowSetImageDimensions$)),
      ([values, theEditor, imageUploadHandler, dialogState, allowSetImageDimensions]) => {
        const handler =
          dialogState.type === 'editing'
            ? (src: string) => {
                theEditor?.update(() => {
                  const { nodeKey } = dialogState
                  const imageNode = $getNodeByKey(nodeKey)! as ImageNode

                  imageNode.setTitle(values.title)
                  imageNode.setAltText(values.altText)
                  imageNode.setSrc(src)

                  if (allowSetImageDimensions) {
                    const width = parseImageDimension(values.width)
                    const height = parseImageDimension(values.height)

                    imageNode.setWidthAndHeight(width ?? 'inherit', height ?? 'inherit')
                  }
                })
                r.pub(imageDialogState$, { type: 'inactive' })
              }
            : (src: string) => {
                r.pub(internalInsertImage$, { ...values, src })
                r.pub(imageDialogState$, { type: 'inactive' })
              }

        if (values.file && values.file.length > 0) {
          if (imageUploadHandler) {
            uploadImage(r, imageUploadHandler, values.file.item(0)!)
              .then(handler)
              .catch((e: unknown) => {
                throw e
              })
          }
        } else if (values.src) {
          handler(values.src)
        }
      }
    )

    r.pub(createActiveEditorSubscription$, (editor) => {
      const theUploadHandler = r.getValue(imageUploadHandler$)
      return mergeRegister(
        editor.registerCommand<InsertImagePayload>(
          INSERT_IMAGE_COMMAND,
          (payload) => {
            const imageNode = $createImageNode(payload)
            $insertNodes([imageNode])
            if ($isRootOrShadowRoot(imageNode.getParentOrThrow())) {
              $wrapNodeInElement(imageNode, $createParagraphNode).selectEnd()
            }

            return true
          },
          COMMAND_PRIORITY_EDITOR
        ),
        editor.registerCommand<DragEvent>(
          DRAGSTART_COMMAND,
          (event) => {
            return onDragStart(event)
          },
          COMMAND_PRIORITY_HIGH
        ),
        editor.registerCommand<DragEvent>(
          DRAGOVER_COMMAND,
          (event) => {
            return onDragover(event, !!r.getValue(imageUploadHandler$), (dragOver) => r.pub(imageDragOver$, dragOver))
          },
          COMMAND_PRIORITY_LOW
        ),

        editor.registerCommand<DragEvent>(
          DROP_COMMAND,
          (event) => {
            return onDrop(event, editor, r.getValue(imageUploadHandler$), r)
          },
          COMMAND_PRIORITY_HIGH
        ),
        editor.registerCommand(
          PASTE_COMMAND,
          (event: PasteCommandType) => {
            const dataTransfer =
              'clipboardData' in event
                ? event.clipboardData
                : 'dataTransfer' in event
                  ? event.dataTransfer
                  : null

            if (!dataTransfer) {
              return false
            }

            if (!theUploadHandler) {
              let fromWeb = Array.from(dataTransfer.items)
              fromWeb = fromWeb.filter((i) => i.type.includes('text')) // Strip out the non-image bits

              if (!fromWeb.length || fromWeb.length === 0) {
                return true
              } // If from file system, eject without calling imageUploadHandler.
              return false // If from web, bail.
            }

            const cbPayload = Array.from(dataTransfer.items)
            const isMixedPayload = cbPayload.some((item) => !item.type.includes('image'))
            if (isMixedPayload) return false

            if (!cbPayload.length || cbPayload.length === 0) {
              return false
            } // If no image was present in the collection, bail.

            const imageUploadHandlerValue = r.getValue(imageUploadHandler$)!

            Promise.all(cbPayload.map((file) => uploadImage(r, imageUploadHandlerValue, file.getAsFile()!)))
              .then((urls) => {
                urls.forEach((url) => {
                  editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
                    src: url,
                    altText: ''
                  })
                })
              })
              .catch((e: unknown) => {
                throw e
              })
            return true
          },
          COMMAND_PRIORITY_CRITICAL
        )
      )
    })
  }
)

/**
 * Opens the new image dialog.
 * @group Image
 */
export const openNewImageDialog$ = Action((r) => {
  r.link(r.pipe(openNewImageDialog$, mapTo({ type: 'new' })), imageDialogState$)
})

/**
 * Opens the edit image dialog with the published parameters.
 * @group Image
 */
export const openEditImageDialog$ = Signal<Omit<EditingImageDialogState, 'type'>>((r) => {
  r.link(
    r.pipe(
      openEditImageDialog$,
      map((payload) => ({ type: 'editing' as const, ...payload }))
    ),
    imageDialogState$
  )
})

/**
 * Close the image dialog.
 * @group Image
 */
export const closeImageDialog$ = Action((r) => {
  r.link(r.pipe(closeImageDialog$, mapTo({ type: 'inactive' })), imageDialogState$)
})

export const disableImageSettingsButton$ = Cell<boolean>(false)

/**
 * Allow to set width and height of image through dialog window
 * @group Image
 */

export const allowSetImageDimensions$ = Cell<boolean>(false)

/**
 * Saves the data from the image dialog
 * @group Image
 */
export const saveImage$ = Signal<SaveImageParameters>()

/**
 * Holds the custom EditImageToolbar component.
 * @group Image
 */
export const editImageToolbarComponent$ = Cell<React.FC<EditImageToolbarProps>>(EditImageToolbar)

export const parseImageDimension = (value: string | number | undefined) => {
  if (typeof value === 'undefined') return undefined
  const parsed = parseInt(String(value), 10)

  return Number.isNaN(parsed) ? undefined : parsed
}

/**
 * A plugin that adds support for images.
 * @group Image
 */
export const imagePlugin = realmPlugin<{
  imageUploadHandler?: ImageUploadHandler
  imageAutocompleteSuggestions?: string[]
  disableImageResize?: boolean
  disableImageSettingsButton?: boolean
  allowSetImageDimensions?: boolean
  imagePreviewHandler?: ImagePreviewHandler
  ImageDialog?: (() => JSX.Element) | React.FC
  EditImageToolbar?: (() => JSX.Element) | React.FC
  imagePlaceholder?: (() => JSX.Element) | null
}>({
  init(realm, params) {
    realm.pubIn({
      [addImportVisitor$]: [MdastImageVisitor, MdastHtmlImageVisitor, MdastJsxImageVisitor],
      [addLexicalNode$]: ImageNode,
      [addExportVisitor$]: LexicalImageVisitor,
      [addComposerChild$]: [params?.ImageDialog ?? ImageDialog, ImageUploadOverlay],
      [imageUploadHandler$]: params?.imageUploadHandler ?? null,
      [imageAutocompleteSuggestions$]: params?.imageAutocompleteSuggestions ?? [],
      [disableImageResize$]: Boolean(params?.disableImageResize),
      [disableImageSettingsButton$]: Boolean(params?.disableImageSettingsButton),
      [allowSetImageDimensions$]: Boolean(params?.allowSetImageDimensions),
      [imagePreviewHandler$]: params?.imagePreviewHandler ?? null,
      [editImageToolbarComponent$]: params?.EditImageToolbar ?? EditImageToolbar,
      [imagePlaceholder$]: params?.imagePlaceholder ?? ImagePlaceholder
    })
  },

  update(realm, params) {
    realm.pubIn({
      [imageUploadHandler$]: params?.imageUploadHandler ?? null,
      [imageAutocompleteSuggestions$]: params?.imageAutocompleteSuggestions ?? [],
      [disableImageResize$]: Boolean(params?.disableImageResize),
      [imagePreviewHandler$]: params?.imagePreviewHandler ?? null,
      [allowSetImageDimensions$]: Boolean(params?.allowSetImageDimensions),
      [editImageToolbarComponent$]: params?.EditImageToolbar ?? EditImageToolbar,
      [imagePlaceholder$]: params?.imagePlaceholder ?? ImagePlaceholder
    })
  }
})

/** @internal */
export type InsertImagePayload = Readonly<CreateImageNodeParameters>

const getDOMSelection = (targetWindow: Window | null): Selection | null => (CAN_USE_DOM ? (targetWindow ?? window).getSelection() : null)

/**
 * @internal
 */
export const INSERT_IMAGE_COMMAND: LexicalCommand<InsertImagePayload> = createCommand('INSERT_IMAGE_COMMAND')

const TRANSPARENT_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

function onDragStart(event: DragEvent): boolean {
  const node = getImageNodeInSelection()
  if (!node) {
    return false
  }
  const dataTransfer = event.dataTransfer
  if (!dataTransfer) {
    return false
  }
  dataTransfer.setData('text/plain', '_')
  const img = document.createElement('img')
  img.src = TRANSPARENT_IMAGE
  dataTransfer.setDragImage(img, 0, 0)
  dataTransfer.setData(
    'application/x-lexical-drag',
    JSON.stringify({
      data: {
        altText: node.__altText,
        title: node.__title,
        key: node.getKey(),
        src: node.__src
      },
      type: 'image'
    })
  )

  return true
}

function onDragover(event: DragEvent, hasUploadHandler: boolean, setImageDragOver: (dragOver: boolean) => void): boolean {
  if (hasUploadHandler) {
    const cbPayload = Array.from(event.dataTransfer?.items ?? []).filter(isImageOrVideoItem)

    if (cbPayload.length > 0) {
      setImageDragOver(true)
      event.preventDefault()
      return true
    }
  }

  // handle moving images
  const node = getImageNodeInSelection()
  if (!node) {
    return false
  }
  if (!canDropImage(event)) {
    event.preventDefault()
  }

  return true
}

function onDrop(event: DragEvent, editor: LexicalEditor, imageUploadHandler: ImageUploadHandler, r: Realm): boolean {
  r.pub(imageDragOver$, false)
  const cbPayload = Array.from(event.dataTransfer?.items ?? []).filter(isImageOrVideoItem)

  if (cbPayload.length > 0) {
    if (imageUploadHandler !== null) {
      event.preventDefault()
      Promise.all(
        cbPayload.map((image) => {
          if (image.kind === 'string') {
            return new Promise<string>((rs) => {
              image.getAsString(rs)
            })
          }
          return uploadImage(r, imageUploadHandler, image.getAsFile()!)
        })
      )
        .then((urls) => {
          urls.forEach((url) => {
            editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
              src: url,
              altText: ''
            })
          })
        })
        .catch((e: unknown) => {
          throw e
        })

      return true
    }
  }

  const node = getImageNodeInSelection()
  if (!node) {
    return false
  }
  const data = getDragImageData(event)

  if (!data) {
    return false
  }

  event.preventDefault()
  if (canDropImage(event)) {
    const range = getDragSelection(event)
    node.remove()
    const rangeSelection = $createRangeSelection()
    if (range !== null && range !== undefined) {
      rangeSelection.applyDOMRange(range)
    }
    $setSelection(rangeSelection)
    editor.dispatchCommand(INSERT_IMAGE_COMMAND, data)
  }
  return true
}

const isImageOrVideoItem = (item: DataTransferItem) =>
  item.type.startsWith('image/') || item.type.startsWith('video/')

function getImageNodeInSelection(): ImageNode | null {
  const selection = $getSelection()
  if (!$isNodeSelection(selection)) {
    return null
  }
  const nodes = selection.getNodes()
  const node = nodes[0]
  return $isImageNode(node) ? node : null
}

function getDragImageData(event: DragEvent): null | InsertImagePayload {
  const dragData = event.dataTransfer?.getData('application/x-lexical-drag')
  if (!dragData) {
    return null
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { type, data } = JSON.parse(dragData)
  if (type !== 'image') {
    return null
  }

  return data
}

declare global {
  interface DragEvent {
    rangeOffset?: number
    rangeParent?: Node
  }
}

function canDropImage(event: DragEvent): boolean {
  const target = event.target
  return !!(target && target instanceof HTMLElement && target.parentElement)
}

function getDragSelection(event: DragEvent): Range | null | undefined {
  let range
  const target = event.target as null | Element | Document
  const targetWindow =
    target == null ? null : target.nodeType === 9 ? (target as Document).defaultView : (target as Element).ownerDocument.defaultView
  const domSelection = getDOMSelection(targetWindow)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(event.clientX, event.clientY)
  } else if (event.rangeParent && domSelection !== null) {
    domSelection.collapse(event.rangeParent, event.rangeOffset ?? 0)
    range = domSelection.getRangeAt(0)
  } else {
    throw Error(`Cannot get the selection when dragging`)
  }

  return range
}
