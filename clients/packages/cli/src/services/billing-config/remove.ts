import { applyEdits, modify } from 'jsonc-parser'
import {
  type Range,
  sectionRange,
} from '@/services/billing-config/script-locations'

export interface Removal {
  readonly section: string
  readonly id: string
}

const STRINGS_AND_COMMENTS =
  /\/\/[^\n]*|\/\*[\s\S]*?\*\/|(['"`])(?:\\[\s\S]|(?!\1)[^\\])*\1/g

// Same offsets as the source, with comments and string contents blanked so their brackets don't count
const codeOnly = (source: string) =>
  source.replace(STRINGS_AND_COMMENTS, (match, quote?: string) =>
    quote
      ? `${quote}${' '.repeat(match.length - 2)}${quote}`
      : ' '.repeat(match.length),
  )

const QUOTED = String.raw`(['"\`])((?:\\[\s\S]|(?!\1)[^\\])*)\1`
const KEY = new RegExp(String.raw`^(?:${QUOTED}|([A-Za-z_$][\w$]*))\s*:`)
const TUPLE_KEY = new RegExp(String.raw`^\[\s*${QUOTED}\s*,`)

// The generator writes keys with JSON.stringify; other escapes fall back to raw text and get reported as missing
const decode = (text: string) => {
  try {
    return JSON.parse(`"${text}"`) as string
  } catch {
    return text
  }
}

const OPENING = '{(['
const CLOSING = '})]'

const entryRanges = (code: string, open: number) => {
  const ranges: Range[] = []
  let depth = 0
  let start = open + 1
  for (let index = start; index < code.length; index++) {
    const character = code.charAt(index)
    if (depth === 0 && character === ',') {
      ranges.push({ start, end: index + 1 })
      start = index + 1
    } else if (depth === 0 && CLOSING.includes(character)) {
      ranges.push({ start, end: index })
      break
    } else if (OPENING.includes(character)) depth++
    else if (CLOSING.includes(character)) depth--
  }
  return ranges
}

const trim = (code: string, { start, end }: Range): Range => {
  const text = code.slice(start, end)
  return {
    start: end - text.trimStart().length,
    end: start + text.trimEnd().length,
  }
}

// Entries a section returns, as an object literal like `meters: ({ meter }) => ({ apples: … })`
// or as `[external_id, definition]` tuples when the generator can't keep the key order
const sectionEntries = (source: string, section: string) => {
  const code = codeOnly(source)
  const range = sectionRange(source, section)
  const body = code.slice(range.start, range.end)
  const returned = /^\s*\{/.test(body)
    ? [...body.matchAll(/\breturn\s*\(?\s*[{[]/g)].at(-1)
    : undefined
  const offset =
    returned === undefined
      ? body.search(/[{[]/)
      : returned.index + returned[0].length - 1
  if (offset === -1) return new Map<string, Range>()
  const open = range.start + offset
  const pattern = code.charAt(open) === '[' ? TUPLE_KEY : KEY
  return new Map(
    entryRanges(code, open)
      .map((entry) => trim(code, entry))
      .flatMap((entry) => {
        const match = pattern.exec(source.slice(entry.start, entry.end))
        const key = match?.[2] === undefined ? match?.[3] : decode(match[2])
        return key === undefined ? [] : [[key, entry] as const]
      }),
  )
}

const wholeLines = (source: string, { start, end }: Range): Range => {
  const lineStart = source.lastIndexOf('\n', start - 1) + 1
  const newline = source.indexOf('\n', end)
  const lineEnd = newline === -1 ? source.length : newline + 1
  return /^\s*$/.test(source.slice(lineStart, start)) &&
    /^\s*$/.test(source.slice(end, lineEnd))
    ? { start: lineStart, end: lineEnd }
    : { start, end: end + (/^ */.exec(source.slice(end))?.[0].length ?? 0) }
}

/**
 * Removes entries from a config script without touching anything else in it.
 * Returns the removals it could not find, in which case the source is unchanged.
 */
export const removeFromScript = (
  source: string,
  removals: ReadonlyArray<Removal>,
) => {
  const sections = new Map(
    [...new Set(removals.map(({ section }) => section))].map((section) => [
      section,
      sectionEntries(source, section),
    ]),
  )
  const ranges = removals.map(({ section, id }) =>
    sections.get(section)?.get(id),
  )
  const missing = removals.filter((_, index) => ranges[index] === undefined)
  if (missing.length > 0) return { source, missing }
  return {
    source: ranges
      .filter((range) => range !== undefined)
      .map((range) => wholeLines(source, range))
      .toSorted((a, b) => b.start - a.start)
      .reduce(
        (text, { start, end }) => text.slice(0, start) + text.slice(end),
        source,
      ),
    missing,
  }
}

export const removeFromJson = (
  source: string,
  input: unknown,
  removals: ReadonlyArray<Removal>,
) => {
  const sections = (input ?? {}) as Record<string, unknown>
  const targets = removals.map((removal) => {
    const items = sections[removal.section]
    return {
      removal,
      index: Array.isArray(items)
        ? items.findIndex(
            (item: { external_id?: unknown }) =>
              item?.external_id === removal.id,
          )
        : -1,
    }
  })
  const missing = targets
    .filter(({ index }) => index === -1)
    .map(({ removal }) => removal)
  if (missing.length > 0) return { source, missing }
  return {
    source: targets
      .toSorted((a, b) => b.index - a.index)
      .reduce(
        (text, { removal, index }) =>
          applyEdits(
            text,
            modify(text, [removal.section, index], undefined, {}),
          ),
        source,
      ),
    missing,
  }
}
