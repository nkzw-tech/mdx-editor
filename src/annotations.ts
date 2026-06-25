export type MarkdownAnnotationRect = {
  height: number
  left: number
  top: number
  width: number
}

export type MarkdownAnnotationBlock = {
  fingerprint: string
  path: number[]
  runtimeKey?: string
  text: string
  type: string
}

export type MarkdownAnnotationQuote = {
  end: number
  exact: string
  prefix: string
  start: number
  suffix: string
}

export type MarkdownAnnotationAnchor = {
  block: MarkdownAnnotationBlock
  kind: 'block' | 'text'
  quote?: MarkdownAnnotationQuote
  version: 1
}

export type MarkdownAnnotation = {
  anchor: MarkdownAnnotationAnchor
  id: string
}

export type MarkdownAnnotationLayout = {
  detached: boolean
  id: string
  rect?: MarkdownAnnotationRect
}

export type MarkdownCommentTarget = {
  anchor: MarkdownAnnotationAnchor
  label: string
  rect: MarkdownAnnotationRect
}

