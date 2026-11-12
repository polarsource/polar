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

const DECLARATION = /^([ \t]+)([A-Za-z_]\w*)[ \t]*(?::[^=\n]+)?=(?!=)/gm

const STRING_OR_COMMENT =
  /("""|''')[\s\S]*?\1|(["'])(?:\\.|(?!\2)[^\\\n])*\2|#[^\n]*/g
const EXPLICIT_ID = /\bexternal_id\s*=\s*(?=["'])/g

const blankStringsAndComments = (source: string) =>
  source.replace(STRING_OR_COMMENT, (text: string, tripleQuote?: string) => {
    const quote = text.startsWith('#') ? 0 : (tripleQuote?.length ?? 1)
    const inside = text.slice(quote, text.length - quote)
    return `${text.slice(0, quote)}${inside.replace(/[^\n]/g, ' ')}${text.slice(text.length - quote)}`
  })

interface Declaration {
  readonly name: string
  readonly start: number
  readonly end: number
}

const classLevelDeclarations = (
  source: string,
  code: string,
  from: number,
  to: number,
): ReadonlyArray<Declaration> => {
  const found = [...code.slice(from, to).matchAll(DECLARATION)].map((match) => {
    const indent = match[1]!.length
    const start = from + match.index + indent
    const next = new RegExp(`\\n[ \\t]{0,${indent}}[^\\s)\\]}]`).exec(
      source.slice(start),
    )
    return {
      name: match[2]!,
      indent,
      start,
      end: next === null ? source.length : start + next.index,
    }
  })
  const classLevel = Math.min(...found.map(({ indent }) => indent))
  return found.filter(({ indent }) => indent === classLevel)
}

const hasExplicitId = (
  source: string,
  code: string,
  { start, end }: Declaration,
  externalId: string,
) => {
  const literal = new RegExp(`^(['"])${escapePattern(externalId)}\\1`)
  return [...code.slice(start, end).matchAll(EXPLICIT_ID)].some((keyword) =>
    literal.test(source.slice(start + keyword.index + keyword[0].length)),
  )
}

export const entryOf = (
  source: string,
  section: string,
  externalId: string,
) => {
  const code = blankStringsAndComments(source)
  const within = (from: number, to: number) => {
    const entries = classLevelDeclarations(source, code, from, to)
    return (
      entries.find((entry) => hasExplicitId(source, code, entry, externalId)) ??
      entries.findLast(({ name }) => name === externalId)
    )
  }
  const body = classBody(source, section)
  return within(body.start, body.end) ?? within(0, source.length)
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
      length: entry.name.length,
    }
  return span(source, found.offset, found.length)
}
