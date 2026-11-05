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
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

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
  for (let n = 2; taken.has(key); n++) key = `${base}-${n}`
  taken.add(key)
  return key
}

export const unkeyed = (
  document: ConfigDocument,
  skipped: ReadonlyArray<SkippedResource>,
): Unkeyed[] => {
  const taken = new Map<KeyedResource, Set<string>>()
  return skipped.flatMap(({ resource, id, name, reason }) => {
    if (reason !== 'missing_external_id' || !isKeyed(resource)) return []
    const keys = taken.get(resource) ?? takenKeys(document, resource)
    taken.set(resource, keys)
    return [
      {
        resource,
        id,
        name,
        suggestion: unique(slugify(name) || resource, keys),
      },
    ]
  })
}
