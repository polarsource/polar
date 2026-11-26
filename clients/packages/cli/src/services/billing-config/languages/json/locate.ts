import { findNodeAtLocation, parseTree } from 'jsonc-parser'
import type { SourceLocation } from '@/schemas/BillingConfig'
import {
  type SourcePath,
  span,
} from '@/services/billing-config/languages/language'

export const locateInJson = (
  source: string,
  path: SourcePath,
  target: 'key' | 'value' = 'value',
): SourceLocation | undefined => {
  let node = parseTree(source)
  if (!node) return undefined
  for (const segment of path) {
    node = findNodeAtLocation(node, [segment]) ?? node
  }
  const key = node.parent?.children?.[0]
  if (target === 'key' && node.parent?.type === 'property' && key) {
    node = key
  }
  const lineEnd = source.indexOf('\n', node.offset)
  const restOfLine = (lineEnd === -1 ? source.length : lineEnd) - node.offset
  return span(source, node.offset, Math.min(node.length, restOfLine))
}
