/**
 * Keys items that carry no id by their content, numbering repeats so
 * identical items still get unique keys. Only for lists that never reorder.
 */
export const keyByContent = <T>(
  items: T[],
  content: (item: T) => string = (item) => JSON.stringify(item),
) => {
  const seen = new Map<string, number>()
  return items.map((item) => {
    const base = content(item)
    const repeat = seen.get(base) ?? 0
    seen.set(base, repeat + 1)
    return { item, key: repeat === 0 ? base : `${base}#${repeat}` }
  })
}
