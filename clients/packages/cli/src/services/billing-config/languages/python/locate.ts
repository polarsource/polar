import type { SourceLocation } from '@/schemas/BillingConfig'
import {
  escapePattern,
  findIn,
  type SourcePath,
  span,
} from '@/services/billing-config/languages/language'
import { record } from '@/utils/billing-config/describe'

const KEYWORDS: Record<string, RegExp> = {
  filter: /\b(?:on|where)=/,
  aggregation: /\baggregate=/,
}

const keywordOf = (field: string) =>
  KEYWORDS[field] ?? new RegExp(`\\b${escapePattern(field)}=`)

const literalOf = (value: unknown) => {
  if (typeof value === 'string') {
    return new RegExp(`(['"])${escapePattern(value)}\\1`)
  }
  if (typeof value === 'boolean') {
    return new RegExp(`\\b${value ? 'True' : 'False'}\\b`)
  }
  return typeof value === 'number'
    ? new RegExp(`(?<![\\w.])${escapePattern(String(value))}(?![\\w.])`)
    : undefined
}

export const classBody = (source: string, section: string) => {
  const whole = { start: 0, end: source.length }
  const name = new RegExp(
    `\\b${escapePattern(section)}\\s*=\\s*([A-Za-z_]\\w*)`,
  ).exec(source)?.[1]
  const header =
    name && new RegExp(`^class ${escapePattern(name)}\\b.*$`, 'm').exec(source)
  if (!header) return whole
  const start = header.index + header[0].length
  const next = /\n\S/.exec(source.slice(start))
  return { start, end: next === null ? source.length : start + next.index }
}

export const entryOf = (
  source: string,
  section: string,
  externalId: string,
) => {
  const declaration = new RegExp(
    `^([ \\t]+)${escapePattern(externalId)}[ \\t]*(?::[^=\\n]+)?=(?!=)`,
    'gm',
  )
  const body = classBody(source, section)
  const inClass = [
    ...source.slice(body.start, body.end).matchAll(declaration),
  ].at(-1)
  const match = inClass ?? [...source.matchAll(declaration)].at(-1)
  if (match === undefined) return undefined
  const indent = match[1]!.length
  const start = (inClass ? body.start : 0) + match.index + indent
  const next = new RegExp(`\\n[ \\t]{0,${indent}}[^\\s)\\]}]`).exec(
    source.slice(start),
  )
  return { start, end: next === null ? source.length : start + next.index }
}

export const locateInPython = (
  source: string,
  input: unknown,
  path: SourcePath,
  got: unknown,
  target: 'key' | 'value' = 'value',
): SourceLocation | undefined => {
  const [section, index, field] = path
  if (typeof section !== 'string') return undefined
  const entries = record(input)?.[section]
  if (typeof index !== 'number' || !Array.isArray(entries)) {
    const keyword = findIn(source, keywordOf(section), 0, source.length)
    return keyword && span(source, keyword.offset, section.length)
  }
  const externalId = record(entries[index])?.['external_id']
  if (typeof externalId !== 'string') return undefined
  const entry = entryOf(source, section, externalId)
  if (entry === undefined) return undefined
  const keyword =
    typeof field === 'string'
      ? findIn(source, keywordOf(field), entry.start, entry.end)
      : undefined
  const literal = target === 'key' ? undefined : literalOf(got)
  const value =
    literal &&
    findIn(source, literal, keyword?.offset ?? entry.start, entry.end)
  const found = value ??
    (keyword && { offset: keyword.offset, length: keyword.length - 1 }) ?? {
      offset: entry.start,
      length: externalId.length,
    }
  return span(source, found.offset, found.length)
}
