export type Change = 'added' | 'changed' | 'removed'

export type Line = {
  change: Change
  field: string
  before?: unknown
  after?: unknown
}

export type Entry<T> = {
  key: string
  item: T
  change: Change
  lines: Line[]
}

type Item = { external_id: string; deprecated?: boolean | null }

const hiddenFields = new Set(['external_id', 'deprecated'])

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isEmpty = (value: unknown) =>
  value == null || (typeof value === 'object' && !Object.keys(value).length)

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// Prices of the same type, currency and meter read as one price that changed
const pairKey = (value: unknown) =>
  JSON.stringify(
    isObject(value) && 'amount_type' in value
      ? [value.amount_type, value.price_currency, value.meter]
      : value,
  )

const diffList = (field: string, before: unknown[], after: unknown[]) => {
  const added = after.filter(
    (value) => !before.some((other) => same(value, other)),
  )
  const lines: Line[] = []
  for (const value of before) {
    if (after.some((other) => same(value, other))) continue
    const index = added.findIndex((other) => pairKey(other) === pairKey(value))
    lines.push(
      index === -1
        ? { change: 'removed', field, before: value }
        : {
            change: 'changed',
            field,
            before: value,
            after: added.splice(index, 1)[0],
          },
    )
  }
  return [
    ...lines,
    ...added.map((value): Line => ({ change: 'added', field, after: value })),
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

  if (isEmpty(before)) return [{ change: 'added', field, after }]
  if (isEmpty(after)) return [{ change: 'removed', field, before }]
  return [{ change: 'changed', field, before, after }]
}

// Deprecated items are still exported, but they're no longer in the version
const byKey = <T extends Item>(items: T[]) =>
  new Map(
    items
      .filter((item) => !item.deprecated)
      .map((item) => [item.external_id, item]),
  )

export const diffItems = <T extends Item>(
  before: T[],
  after: T[],
  nameField: string,
) => {
  const beforeItems = byKey(before)
  const afterItems = byKey(after)
  const keys = new Set([...afterItems.keys(), ...beforeItems.keys()])

  const entries: Entry<T>[] = []
  const unchanged: T[] = []
  for (const key of keys) {
    const beforeItem = beforeItems.get(key)
    const afterItem = afterItems.get(key)
    const addedOrRemoved = !beforeItem || !afterItem
    const fields = new Set([
      ...Object.keys(beforeItem ?? {}),
      ...Object.keys(afterItem ?? {}),
    ])
    const lines = [...fields]
      .filter((field) => !hiddenFields.has(field))
      // A new or removed item's name is already its header
      .filter((field) => !(addedOrRemoved && field === nameField))
      .flatMap((field) =>
        diffValue(
          field,
          beforeItem?.[field as keyof T],
          afterItem?.[field as keyof T],
        ),
      )
    if (!beforeItem) {
      entries.push({ key, item: afterItem!, change: 'added', lines })
    } else if (!afterItem) {
      entries.push({ key, item: beforeItem, change: 'removed', lines })
    } else if (lines.length) {
      entries.push({ key, item: afterItem, change: 'changed', lines })
    } else {
      unchanged.push(afterItem)
    }
  }
  return { entries, unchanged }
}
