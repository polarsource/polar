import type {
  Removal,
  Removed,
} from '@/services/billing-config/languages/language'
import {
  classBody,
  entryOf,
} from '@/services/billing-config/languages/python/locate'

const STATEMENT = /^[ \t]+[^\s#]/m

const keepClassBodies = (source: string, sections: ReadonlySet<string>) =>
  [...sections].reduce((text, section) => {
    const body = classBody(text, section)
    return body.start === 0 || STATEMENT.test(text.slice(body.start, body.end))
      ? text
      : `${text.slice(0, body.start)}\n    pass${text.slice(body.start)}`
  }, source)

export const removeFromPython = (
  source: string,
  removals: ReadonlyArray<Removal>,
): Removed => {
  const entries = removals.map(({ section, id }) =>
    entryOf(source, section, id),
  )
  const missing = removals.filter((_, index) => entries[index] === undefined)
  if (missing.length > 0) return { source, missing }
  const edited = entries
    .filter((entry) => entry !== undefined)
    .map(({ start, end }) => ({
      start: source.lastIndexOf('\n', start) + 1,
      end: start + source.slice(start, end).trimEnd().length + 1,
    }))
    .toSorted((a, b) => b.start - a.start)
    .reduce(
      (text, { start, end }) => text.slice(0, start) + text.slice(end),
      source,
    )
  return {
    source: keepClassBodies(
      edited,
      new Set(removals.map(({ section }) => section)),
    ),
    missing,
  }
}
