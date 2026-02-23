import { Effect } from 'effect'
import type { FlatTokenMap, ThemeConfig } from '../types.js'
import { FormatError } from './css.js'

/** Build a nested object from a flat token map's rawPaths */
function buildNested(
  entries: Iterable<[string[], string | number]>,
): Record<string, unknown> {
  const root: Record<string, unknown> = {}
  for (const [rawPath, value] of entries) {
    let node: Record<string, unknown> = root
    for (let i = 0; i < rawPath.length - 1; i++) {
      const key = rawPath[i]!
      if (typeof node[key] !== 'object' || node[key] === null) {
        node[key] = {}
      }
      node = node[key] as Record<string, unknown>
    }
    node[rawPath[rawPath.length - 1]!] = value
  }
  return root
}

/**
 * Format a FlatTokenMap as TypeScript `as const` exports.
 *
 * Always emits:
 * ```ts
 * export const tokens = { ... } as const
 * ```
 *
 * When `themes` is provided and tokens carry theme overrides, also emits:
 * ```ts
 * export const themes = {
 *   dark: { button: { background: '...' } },
 * } as const
 * ```
 */
export const formatTypescript = (
  map: FlatTokenMap,
  themes?: ThemeConfig,
): Effect.Effect<string, FormatError> =>
  Effect.try({
    try: () => {
      const parts: string[] = []

      // Default tokens
      const defaultEntries: [string[], string | number][] = []
      for (const token of map.values()) {
        defaultEntries.push([token.rawPath, token.value])
      }
      parts.push(
        `export const tokens = ${JSON.stringify(buildNested(defaultEntries), null, 2)} as const`,
      )

      // Per-theme objects
      if (themes) {
        const themeObjects: Record<string, Record<string, unknown>> = {}

        for (const [themeName] of Object.entries(themes)) {
          const themeEntries: [string[], string | number][] = []
          for (const token of map.values()) {
            const tv = token.themeValues?.[themeName]
            if (tv !== undefined) {
              themeEntries.push([token.rawPath, tv.value])
            }
          }
          if (themeEntries.length > 0) {
            themeObjects[themeName] = buildNested(themeEntries)
          }
        }

        if (Object.keys(themeObjects).length > 0) {
          parts.push(
            `export const themes = ${JSON.stringify(themeObjects, null, 2)} as const`,
          )
        }
      }

      return parts.join('\n\n') + '\n'
    },
    catch: (cause) => new FormatError({ format: 'typescript', cause }),
  })
