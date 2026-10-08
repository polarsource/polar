type Row = Record<string, unknown>

export interface Unmatched {
  field: string
  parent: string
  available: string[]
}

export type Selection =
  | { _tag: 'Selected'; value: unknown; unmatched: Unmatched[] }
  | { _tag: 'UnknownFields'; unknown: string[]; available: string[] }

const isRow = (value: unknown): value is Row =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const keys = (rows: ReadonlyArray<Row>) => [
  ...new Set(rows.flatMap((row) => Object.keys(row))),
]

const pick = (value: unknown, paths: ReadonlyArray<string[]>): unknown => {
  if (Array.isArray(value)) return value.map((item) => pick(item, paths))
  if (!isRow(value)) return value
  const picked: Row = {}
  for (const [key] of paths) {
    if (key === undefined || key in picked || !(key in value)) continue
    const nested = paths
      .filter(([first, ...rest]) => first === key && rest.length > 0)
      .map(([, ...rest]) => rest)
    const whole = paths.some((path) => path[0] === key && path.length === 1)
    picked[key] =
      whole || nested.length === 0 ? value[key] : pick(value[key], nested)
  }
  return picked
}

const unmatched = (
  rows: ReadonlyArray<Row>,
  path: ReadonlyArray<string>,
): Unmatched[] => {
  let level = rows
  for (const [depth, key] of path.entries()) {
    if (level.length > 0 && !level.some((row) => key in row)) {
      return [
        {
          field: path.slice(0, depth + 1).join('.'),
          parent: path.slice(0, depth).join('.'),
          available: keys(level),
        },
      ]
    }
    level = level.flatMap((row) => [row[key]].flat()).filter(isRow)
  }
  return []
}

export const selectFields = (result: unknown, fields: string): Selection => {
  const paths = fields
    .split(',')
    .map((field) => field.trim())
    .filter((field) => field !== '')
    .map((field) => field.split('.'))
  if (paths.length === 0) {
    return { _tag: 'Selected', value: result, unmatched: [] }
  }
  const listed =
    isRow(result) &&
    Array.isArray(result['items']) &&
    isRow(result['pagination'])
  const rows = (
    listed ? (result['items'] as unknown[]) : [result].flat()
  ).filter(isRow)
  const misses = paths.flatMap((path) => unmatched(rows, path))
  const unknown = misses.filter(({ parent }) => parent === '')
  if (unknown.length > 0) {
    return {
      _tag: 'UnknownFields',
      unknown: [...new Set(unknown.map(({ field }) => field))],
      available: keys(rows),
    }
  }
  return {
    _tag: 'Selected',
    value: listed
      ? { ...result, items: pick(result['items'], paths) }
      : pick(result, paths),
    unmatched: misses,
  }
}
