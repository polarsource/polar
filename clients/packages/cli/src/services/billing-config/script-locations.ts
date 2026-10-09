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

const keyPattern = (key: string) =>
  new RegExp(`(?<=^|[\\s{,[(])(['"\`]?)${escape(key)}\\1(?=\\s*[:,\\]])`, 'm')

const literalPattern = (value: unknown) =>
  typeof value === 'string'
    ? new RegExp(`(['"\`])${escape(value)}\\1`)
    : new RegExp(`(?<![\\w.])${escape(String(value))}(?![\\w.])`)

const FIELD_PATTERNS: Record<string, RegExp> = {
  name: /displayName|(?<![\w.])name(?=\s*:)/,
  filter: /\.where\(|(?<![\w.])filter(?=\s*:)/,
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

const anchorsOf = (source: string, externalIds: ReadonlyArray<string>) => {
  const anchors: Array<{ offset: number; length: number } | undefined> = []
  let cursor = 0
  for (const id of externalIds) {
    const pattern = keyPattern(id)
    const ahead = find(source, pattern, cursor, source.length)
    const anchor = ahead ?? find(source, pattern, 0, source.length)
    anchors.push(anchor)
    if (ahead !== undefined) cursor = ahead.offset + ahead.length
  }
  return anchors
}

const entryRange = (
  source: string,
  externalIds: ReadonlyArray<string | undefined>,
  index: number,
) => {
  const known = externalIds.map((id) => id ?? '')
  const anchors = anchorsOf(source, known)
  const start = anchors[index]
  if (start === undefined) return undefined
  const next = anchors
    .slice(index + 1)
    .find((anchor) => anchor !== undefined && anchor.offset > start.offset)
  return { start: start.offset, end: next?.offset ?? source.length }
}

export const locateInScript = (
  source: string,
  input: unknown,
  path: Path,
  got: unknown,
): SourceLocation | undefined => {
  const [section, index, ...rest] = path
  if (typeof section !== 'string' || typeof index !== 'number') return undefined
  const entries = (input as Record<string, unknown>)?.[section]
  if (!Array.isArray(entries)) return undefined
  const externalIds = entries.map((entry: { external_id?: unknown }) =>
    typeof entry?.external_id === 'string' ? entry.external_id : undefined,
  )
  const externalId = externalIds[index]
  if (externalId === undefined) return undefined
  const range = entryRange(source, externalIds, index)
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
