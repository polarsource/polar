import { record } from '@/utils/billing-config/describe'

const SECTIONS = ['meters', 'benefits', 'products'] as const

export interface Names {
  readonly events: ReadonlyArray<string>
  readonly meters: ReadonlyArray<string>
  readonly benefits: ReadonlyArray<string>
  readonly products: ReadonlyArray<string>
}

/** Why names cannot be read from this config, or undefined when they can. */
export const unreadable = (input: unknown) => {
  const config = record(input)
  if (config === undefined) return 'It is not an object.'
  for (const section of SECTIONS) {
    const entries = config[section]
    if (entries === undefined) continue
    if (!Array.isArray(entries)) return `"${section}" is not a list.`
    const missing = entries.findIndex(
      (entry) => typeof record(entry)?.['external_id'] !== 'string',
    )
    if (missing !== -1) return `${section}[${missing}] has no external_id.`
  }
  return undefined
}

const unique = (names: ReadonlyArray<string>) => [...new Set(names)]

const idsOf = (input: unknown, section: string) => {
  const entries = record(input)?.[section]
  return unique(
    (Array.isArray(entries) ? entries : []).flatMap((entry) => {
      const id = record(entry)?.['external_id']
      return typeof id === 'string' ? [id] : []
    }),
  )
}

const eventNames = (filter: unknown): ReadonlyArray<string> => {
  const clause = record(filter)
  if (clause === undefined) return []
  if (Array.isArray(clause['clauses'])) {
    return clause['clauses'].flatMap(eventNames)
  }
  return clause['property'] === 'name' &&
    clause['operator'] === 'eq' &&
    typeof clause['value'] === 'string'
    ? [clause['value']]
    : []
}

const eventsOf = (input: unknown) => {
  const meters = record(input)?.['meters']
  return unique(
    (Array.isArray(meters) ? meters : []).flatMap((meter) =>
      eventNames(record(meter)?.['filter']),
    ),
  )
}

/** The names application code refers to: what a config declares, and the events its meters count. */
export const namesOf = (input: unknown): Names => ({
  events: eventsOf(input),
  meters: idsOf(input, 'meters'),
  benefits: idsOf(input, 'benefits'),
  products: idsOf(input, 'products'),
})
