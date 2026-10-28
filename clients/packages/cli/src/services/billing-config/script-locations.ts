import type { SourceLocation } from '@/schemas/BillingConfig'

type Path = ReadonlyArray<string | number>

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const positionOf = (source: string, offset: number) => {
  const before = source.slice(0, offset)
  return {
    line: before.split('\n').length,
    column: offset - before.lastIndexOf('\n'),
  }
}

const span = (
  source: string,
  offset: number,
  length: number,
): SourceLocation => ({
  ...positionOf(source, offset),
  length,
})

const PARAMETERS = /^\s*:\s*(?:async\s*)?\([^)]*\)\s*=>/

const keyPattern = (key: string) =>
  new RegExp(`(?<=^|[\\s{,[(])(['"\`]?)${escape(key)}\\1(?=\\s*[:,\\]])`, 'm')

const literalPattern = (value: unknown) =>
  typeof value === 'string'
    ? new RegExp(`(['"\`])${escape(value)}\\1`)
    : new RegExp(`(?<![\\w.])${escape(String(value))}(?![\\w.])`)

const FIELD_PATTERNS: Record<string, RegExp> = {
  name: /displayName|(?<![\w.])name(?=\s*:)/,
  filter: /\.where\(|\.on\(|(?<![\w.])filter(?=\s*:)/,
  aggregation:
    /\.(count|sum|max|min|avg|unique)\(|(?<![\w.])aggregation(?=\s*:)/,
  unit: /\.unit\(|(?<![\w.])unit(?=\s*:)/,
  custom_label: /\.unit\(|(?<![\w.])custom_label(?=\s*:)/,
}

const find = (source: string, pattern: RegExp, from: number, to: number) => {
  const match = pattern.exec(source.slice(from, to))
  return match === null
    ? undefined
    : { offset: from + match.index, length: match[0].length }
}

export type Range = { start: number; end: number }

const findAll = (source: string, pattern: RegExp, from: number) =>
  [...source.slice(from).matchAll(new RegExp(pattern.source, 'gm'))].map(
    (match) => ({ offset: from + match.index, length: match[0].length }),
  )

const SECTIONS = [
  'settings',
  'events',
  'meters',
  'benefits',
  'products',
  'webhooks',
]

const columnOf = (source: string, offset: number) =>
  offset - source.lastIndexOf('\n', offset - 1)

const sectionKey = (source: string, section: string) => {
  const own = findAll(source, keyPattern(section), 0)
  const columns = own.map(({ offset }) => columnOf(source, offset))
  return own[columns.indexOf(Math.min(...columns))]
}

export const sectionRange = (source: string, section: string): Range => {
  const whole = { start: 0, end: source.length }
  const column = ({ offset }: { offset: number }) => columnOf(source, offset)
  const start = sectionKey(source, section)
  if (start === undefined) return whole
  const key = start.offset + start.length
  const from = key + (PARAMETERS.exec(source.slice(key))?.[0].length ?? 0)
  const ends = SECTIONS.filter((other) => other !== section).flatMap((other) =>
    findAll(source, keyPattern(other), from)
      .filter((match) => column(match) <= column(start))
      .map(({ offset }) => offset),
  )
  return { start: from, end: Math.min(source.length, ...ends) }
}

const anchorsOf = (
  source: string,
  externalIds: ReadonlyArray<string>,
  range: Range,
) => {
  const anchors: Array<{ offset: number; length: number } | undefined> = []
  let cursor = range.start
  for (const id of externalIds) {
    const pattern = keyPattern(id)
    const ahead = find(source, pattern, cursor, range.end)
    const anchor = ahead ?? find(source, pattern, range.start, range.end)
    anchors.push(anchor)
    if (ahead !== undefined) cursor = ahead.offset + ahead.length
  }
  return anchors
}

const entryRange = (
  source: string,
  section: string,
  externalIds: ReadonlyArray<string | undefined>,
  index: number,
): Range | undefined => {
  const known = externalIds.map((id) => id ?? '')
  const within = sectionRange(source, section)
  const anchors = anchorsOf(source, known, within)
  const start = anchors[index]
  if (start === undefined) return undefined
  const next = anchors
    .slice(index + 1)
    .find((anchor) => anchor !== undefined && anchor.offset > start.offset)
  return { start: start.offset, end: next?.offset ?? within.end }
}

const locateInObject = (
  source: string,
  section: string,
  keys: Path,
  got: unknown,
): SourceLocation | undefined => {
  const range = sectionRange(source, section)
  let key: { offset: number; length: number } | undefined
  for (const part of keys) {
    if (typeof part !== 'string') break
    const match = find(
      source,
      keyPattern(part),
      key ? key.offset + key.length : range.start,
      range.end,
    )
    if (match === undefined) break
    key = match
  }
  if (key === undefined) return undefined
  const target =
    (got !== undefined &&
      find(source, literalPattern(got), key.offset + key.length, range.end)) ||
    key
  return span(source, target.offset, target.length)
}

export const locateInScript = (
  source: string,
  input: unknown,
  path: Path,
  got: unknown,
): SourceLocation | undefined => {
  const [section, index, ...rest] = path
  if (typeof section !== 'string') return undefined
  if (index === undefined) {
    const key = sectionKey(source, section)
    return key && span(source, key.offset, key.length)
  }
  const entries = (input as Record<string, unknown>)?.[section]
  if (typeof index !== 'number') {
    return typeof entries === 'object' && entries !== null
      ? locateInObject(source, section, path.slice(1), got)
      : undefined
  }
  if (!Array.isArray(entries)) return undefined
  const externalIds = entries.map((entry: { external_id?: unknown }) =>
    typeof entry?.external_id === 'string' ? entry.external_id : undefined,
  )
  const externalId = externalIds[index]
  if (externalId === undefined) return undefined
  const range = entryRange(source, section, externalIds, index)
  if (range === undefined) return undefined
  const field = rest[0]
  const fieldMatch =
    typeof field === 'string' && FIELD_PATTERNS[field]
      ? find(source, FIELD_PATTERNS[field], range.start, range.end)
      : undefined
  const target =
    (got !== undefined &&
      find(
        source,
        literalPattern(got),
        fieldMatch?.offset ?? range.start,
        range.end,
      )) ||
    fieldMatch ||
    find(source, keyPattern(externalId), range.start, range.end)
  return target && span(source, target.offset, target.length)
}
