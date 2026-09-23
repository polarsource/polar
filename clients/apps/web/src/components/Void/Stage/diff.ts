export const definitionKinds = [
  'products',
  'meters',
  'reducers',
  'entitlements',
  'activities',
  'signals',
] as const

export type DefinitionKind = (typeof definitionKinds)[number]
export type Definition = { slug: string; [key: string]: unknown }
export type Configuration = Record<DefinitionKind, Definition[]>

export const emptyConfiguration: Configuration = {
  products: [],
  meters: [],
  reducers: [],
  entitlements: [],
  activities: [],
  signals: [],
}

export interface FieldChange {
  path: string
  before: unknown
  after: unknown
}

export interface DefinitionChange {
  kind: DefinitionKind
  slug: string
  action: 'added' | 'changed' | 'removed'
  fields: FieldChange[]
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical)
  if (!isObject(value)) return value
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonical(value[key])]),
  )
}

const decimal = (value: unknown) =>
  typeof value === 'string'
    ? value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
    : value

const normalized = (kind: DefinitionKind, definition: Definition) => {
  if (kind === 'meters')
    return { ...definition, unit_amount: decimal(definition.unit_amount) }
  if (kind !== 'products') return definition
  return {
    ...definition,
    ...(isObject(definition.price) && {
      price: { ...definition.price, amount: decimal(definition.price.amount) },
    }),
    ...(Array.isArray(definition.meters) && {
      meters: [...definition.meters].sort((a, b) =>
        String(isObject(a) ? a.slug : a).localeCompare(
          String(isObject(b) ? b.slug : b),
        ),
      ),
    }),
    ...(Array.isArray(definition.entitlements) && {
      entitlements: [...definition.entitlements].sort(),
    }),
  }
}

const changedFields = (
  before: unknown,
  after: unknown,
  path = '',
): FieldChange[] => {
  if (JSON.stringify(canonical(before)) === JSON.stringify(canonical(after)))
    return []
  if (
    (isObject(before) && (isObject(after) || after === undefined)) ||
    (isObject(after) && before === undefined)
  ) {
    const left = isObject(before) ? before : {}
    const right = isObject(after) ? after : {}
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])]
    if (keys.length === 0) return [{ path, before, after }]
    return keys
      .sort()
      .filter((key) => path !== '' || key !== 'slug')
      .flatMap((key) =>
        changedFields(left[key], right[key], path ? `${path}.${key}` : key),
      )
  }
  return [{ path, before, after }]
}

export const configurationDiff = (
  applied: Configuration,
  staged: Configuration,
): DefinitionChange[] =>
  definitionKinds.flatMap((kind) => {
    const before = new Map(
      (applied[kind] ?? []).map((d) => [d.slug, normalized(kind, d)]),
    )
    const after = new Map(
      (staged[kind] ?? []).map((d) => [d.slug, normalized(kind, d)]),
    )
    return [...new Set([...before.keys(), ...after.keys()])]
      .sort()
      .flatMap((slug) => {
        const left = before.get(slug)
        const right = after.get(slug)
        const fields = changedFields(left, right)
        if (left && right && fields.length === 0) return []
        return [
          {
            kind,
            slug,
            action: !left
              ? ('added' as const)
              : !right
                ? ('removed' as const)
                : ('changed' as const),
            fields,
          },
        ]
      })
  })

export const displayValue = (value: unknown): string => {
  if (value === undefined) return '—'
  if (value === null) return 'None'
  if (value === '') return 'Empty string'
  return typeof value === 'string'
    ? value
    : JSON.stringify(canonical(value), null, 2)
}
