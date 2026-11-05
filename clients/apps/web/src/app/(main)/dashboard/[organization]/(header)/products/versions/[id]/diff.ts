export type Line = {
  sign: '+' | '-' | '~'
  field: string
  before?: unknown
  after?: unknown
}

export type Entry<T> = {
  key: string
  item: T
  change: 'added' | 'changed' | 'removed'
  lines: Line[]
}

type Item = { external_id: string; deprecated?: boolean | null }

const hiddenFields = new Set(['external_id', 'deprecated'])

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isEmpty = (value: unknown) =>
  value == null ||
  (Array.isArray(value) && value.length === 0) ||
  (isObject(value) && Object.keys(value).length === 0)

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// Prices of the same type, currency and meter read as one price that changed
const pairKey = (value: unknown) =>
  isObject(value) && 'amount_type' in value
    ? JSON.stringify([value.amount_type, value.price_currency, value.meter])
    : undefined

const diffList = (field: string, before: unknown[], after: unknown[]) => {
  const added = after.filter(
    (value) => !before.some((other) => same(value, other)),
  )
  const lines: Line[] = before
    .filter((value) => !after.some((other) => same(value, other)))
    .map((value) => {
      const key = pairKey(value)
      const index =
        key === undefined
          ? -1
          : added.findIndex((other) => pairKey(other) === key)
      if (index === -1) return { sign: '-', field, before: value }
      return {
        sign: '~',
        field,
        before: value,
        after: added.splice(index, 1)[0],
      }
    })
  return [
    ...lines,
    ...added.map((value): Line => ({ sign: '+', field, after: value })),
  ]
}

export const diffValue = (
  field: string,
  before: unknown,
  after: unknown,
): Line[] => {
  if (same(before, after) || (isEmpty(before) && isEmpty(after))) return []

  const beforeList = before ?? []
  const afterList = after ?? []
  if (Array.isArray(beforeList) && Array.isArray(afterList)) {
    return diffList(field, beforeList, afterList)
  }

  const beforeObject = before ?? {}
  const afterObject = after ?? {}
  if (isObject(beforeObject) && isObject(afterObject)) {
    const keys = new Set([
      ...Object.keys(beforeObject),
      ...Object.keys(afterObject),
    ])
    return [...keys].flatMap((key) =>
      diffValue(key, beforeObject[key], afterObject[key]),
    )
  }

  if (isEmpty(before)) return [{ sign: '+', field, after }]
  if (isEmpty(after)) return [{ sign: '-', field, before }]
  return [{ sign: '~', field, before, after }]
}

// Deprecated items are still exported, but they're no longer in the version
const byKey = <T extends Item>(items: T[]) =>
  new Map(
    items
      .filter((item) => !item.deprecated)
      .map((item) => [item.external_id, item]),
  )

export const diffItems = <T extends Item>(after: T[], before: T[]) => {
  const current = byKey(after)
  const previous = byKey(before)
  const keys = new Set([...current.keys(), ...previous.keys()])

  const entries: Entry<T>[] = []
  const unchanged: T[] = []
  for (const key of keys) {
    const item = current.get(key)
    const previousItem = previous.get(key)
    const fields = new Set([
      ...Object.keys(previousItem ?? {}),
      ...Object.keys(item ?? {}),
    ])
    const lines = [...fields]
      .filter((field) => !hiddenFields.has(field))
      .flatMap((field) =>
        diffValue(
          field,
          previousItem?.[field as keyof T],
          item?.[field as keyof T],
        ),
      )
    if (!previousItem) {
      entries.push({ key, item: item!, change: 'added', lines })
    } else if (!item) {
      entries.push({ key, item: previousItem, change: 'removed', lines })
    } else if (lines.length) {
      entries.push({ key, item, change: 'changed', lines })
    } else {
      unchanged.push(item)
    }
  }
  return { entries, unchanged }
}
