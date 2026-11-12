import { applyEdits, findNodeAtLocation, modify, parseTree } from 'jsonc-parser'
import type { Removal } from '@/services/billing-config/languages/language'

const removeAt = (text: string, section: string, index: number) => {
  const root = parseTree(text)
  const items = (root && findNodeAtLocation(root, [section])?.children) ?? []
  const item = items[index]
  const previous = items[index - 1]
  return item !== undefined &&
    previous !== undefined &&
    index === items.length - 1
    ? text.slice(0, previous.offset + previous.length) +
        text.slice(item.offset + item.length)
    : applyEdits(text, modify(text, [section, index], undefined, {}))
}

export const removeFromJson = (
  source: string,
  input: unknown,
  removals: ReadonlyArray<Removal>,
) => {
  const sections = (input ?? {}) as Record<string, unknown>
  const targets = removals.map((removal) => {
    const items = sections[removal.section]
    return {
      removal,
      index: Array.isArray(items)
        ? items.findIndex(
            (item: { external_id?: unknown }) =>
              item?.external_id === removal.id,
          )
        : -1,
    }
  })
  const missing = targets
    .filter(({ index }) => index === -1)
    .map(({ removal }) => removal)
  if (missing.length > 0) return { source, missing }
  return {
    source: targets
      .toSorted((a, b) => b.index - a.index)
      .reduce(
        (text, { removal, index }) => removeAt(text, removal.section, index),
        source,
      ),
    missing,
  }
}
