import { htmlTags } from '../core/MdastHTMLNode.js'

export function isHtmlTagName(name: string): boolean {
  return (htmlTags as readonly string[]).includes(name)
}
