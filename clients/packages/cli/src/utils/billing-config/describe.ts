import * as ui from '@/utils/ui'

const name = (input: unknown) =>
  ui.printable(String(input)).replace(/\s+/g, ' ').trim()

const OPERATORS: Record<string, string> = {
  eq: '=',
  ne: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  like: '~',
  not_like: '!~',
}

const record = (input: unknown): Record<string, unknown> | undefined =>
  typeof input === 'object' && input !== null && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : undefined

const clause = (input: Record<string, unknown>) =>
  `${name(input['property'])} ${OPERATORS[String(input['operator'])] ?? name(input['operator'])} ${JSON.stringify(input['value'])}`

const filter = (input: Record<string, unknown>, nested = false): string => {
  const clauses = (input['clauses'] as unknown[]).map((item) => {
    const value = record(item)
    return value && 'conjunction' in value
      ? filter(value, true)
      : value
        ? clause(value)
        : JSON.stringify(item)
  })
  if (clauses.length === 0) return 'all events'
  if (clauses.length === 1) return clauses[0] ?? ''
  const conjunction = String(input['conjunction']).toUpperCase()
  return nested
    ? `(${clauses.join(` ${conjunction} `)})`
    : clauses.join(`\n${conjunction} `)
}

const aggregation = (input: Record<string, unknown>) =>
  input['property'] === undefined
    ? name(input['func'])
    : `${name(input['func'])}(${name(input['property'])})`

export const describeValue = (input: unknown): string | undefined => {
  const value = record(input)
  if (!value) return undefined
  if ('conjunction' in value && Array.isArray(value['clauses'])) {
    return filter(value)
  }
  if ('func' in value) return aggregation(value)
  return undefined
}
