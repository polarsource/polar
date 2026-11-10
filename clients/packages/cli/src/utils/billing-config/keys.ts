import { ExternalId } from '@polar-sh/polar'
import { Schema } from 'effect'
import { printable } from '@/utils/ui'
import type {
  ConfigDocument,
  KeyedResource,
  SkippedResource,
} from '@/schemas/BillingConfig'

export interface Unkeyed {
  readonly resource: KeyedResource
  readonly id: string
  readonly name: string
  readonly suggestion: string
  readonly cadence?: string
}

const SECTIONS: Record<KeyedResource, string> = {
  meter: 'meters',
  benefit: 'benefits',
  product: 'products',
}

export const slugify = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')

export const typedKey = (text: string) => {
  const key = text.toLowerCase().replace(/ /g, '_')
  return /^[a-z0-9_.:-]+$/.test(key) ? key : undefined
}

export const isExternalId = Schema.is(ExternalId)

export const EXTERNAL_ID_RULE =
  'use only letters, digits, "_", "-", "." and ":", starting with a letter or digit'

const ADVERBS: Record<string, string> = {
  day: 'daily',
  week: 'weekly',
  month: 'monthly',
  year: 'yearly',
}

const cadence = (interval: string | null, count: number | null) =>
  interval === null
    ? 'one-time'
    : count === null || count === 1
      ? (ADVERBS[interval] ?? `every ${interval}`)
      : `every ${count} ${interval}s`

const isKeyed = (resource: string): resource is KeyedResource =>
  resource in SECTIONS

export const takenKeys = (
  document: ConfigDocument,
  resource: KeyedResource,
) => {
  const entries = document[SECTIONS[resource]]
  return new Set(
    (Array.isArray(entries) ? entries : []).flatMap((entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      'external_id' in entry &&
      typeof entry.external_id === 'string'
        ? [entry.external_id]
        : [],
    ),
  )
}

const unique = (base: string, taken: Set<string>) => {
  let key = base
  for (let n = 2; taken.has(key); n++) key = `${base}_${n}`
  taken.add(key)
  return key
}

export const displayName = ({ id, name, cadence }: Unkeyed) =>
  `${id.split('-')[0]} · ${printable(name)}${cadence === undefined ? '' : ` (${cadence})`}`

export const unkeyed = (
  document: ConfigDocument,
  skipped: ReadonlyArray<SkippedResource>,
): Unkeyed[] => {
  const taken = new Map<KeyedResource, Set<string>>()
  return skipped.flatMap((entry) => {
    const { resource, id, name, reason } = entry
    if (reason !== 'missing_external_id' || !isKeyed(resource)) return []
    const keys = taken.get(resource) ?? takenKeys(document, resource)
    taken.set(resource, keys)
    return [
      {
        resource,
        id,
        name,
        suggestion: unique(slugify(name) || resource, keys),
        ...(resource !== 'product' || entry.recurring_interval === undefined
          ? {}
          : {
              cadence: cadence(
                entry.recurring_interval,
                entry.recurring_interval_count ?? null,
              ),
            }),
      },
    ]
  })
}
