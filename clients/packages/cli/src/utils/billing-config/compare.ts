import { Schema } from 'effect'
import type { ConfigDocument } from '@/schemas/BillingConfig'

const Entry = Schema.Struct({ external_id: Schema.String })

export const externalIdOf = (item: unknown) => {
  const entry = Schema.decodeUnknownOption(Entry)(item)
  return entry._tag === 'Some' ? entry.value.external_id : undefined
}

const normalize = (item: unknown): unknown => {
  if (Array.isArray(item)) return item.map(normalize)
  if (typeof item !== 'object' || item === null) return item
  return Object.fromEntries(
    Object.entries(item)
      .filter(([, value]) => value !== null)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key, normalize(value)]),
  )
}

export const compact = (item: unknown): unknown => {
  const normalized = normalize(item)
  if (typeof normalized !== 'object' || normalized === null) return normalized
  if (Array.isArray(normalized)) return normalized
  const { metadata: _, ...rest } = normalized as Record<string, unknown>
  return rest
}

const canonical = (value: unknown) => JSON.stringify(normalize(value))

const hasOwn = (item: unknown, key: string) =>
  typeof item === 'object' && item !== null && key in item

const sameEntry = (local: unknown, remote: unknown) =>
  canonical(local) ===
  canonical(hasOwn(local, 'metadata') ? remote : compact(remote))

const keyed = (items: ReadonlyArray<unknown>) => {
  const entries = new Map<string, unknown>()
  const repeated = new Set<string>()
  for (const item of items) {
    const id = externalIdOf(item) ?? canonical(item)
    if (entries.has(id)) repeated.add(id)
    entries.set(id, item)
  }
  return { entries, repeated }
}

export interface Difference {
  readonly section: string
  readonly id: string
}

export const differences = (
  local: ConfigDocument,
  remote: ConfigDocument,
): Difference[] =>
  Object.entries(local).flatMap(([section, items]) => {
    const theirs = keyed(remote[section] ?? []).entries
    const mine = keyed(items)
    return [...mine.entries]
      .filter(([id, item]) => {
        const other = theirs.get(id)
        return (
          mine.repeated.has(id) ||
          other === undefined ||
          !sameEntry(item, other)
        )
      })
      .map(([id]) => ({ section, id }))
  })
