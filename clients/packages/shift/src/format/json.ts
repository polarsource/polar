import { Effect } from 'effect'
import type { BreakpointConfig, FlatTokenMap, ThemeConfig, TokenValue } from '../types.js'
import { FormatError } from './css.js'

/** Build a nested object from a flat token map's rawPaths */
function buildNested(
  entries: Iterable<[string[], TokenValue]>,
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
 * Format a FlatTokenMap as JSON.
 *
 * Structure:
 * ```json
 * {
 *   "colors": { "primary": "#0066ff", ... },
 *   "$themes": { "dark": { "button": { "background": "#1a1a2e" } } },
 *   "$breakpoints": { "sm": { "colors": { "primary": "#111111" } } }
 * }
 * ```
 * The `$themes` / `$breakpoints` keys are only included when provided and at
 * least one token carries overrides for that context.
 */
export const formatJson = (
  map: FlatTokenMap,
  themes?: ThemeConfig,
  breakpoints?: BreakpointConfig,
): Effect.Effect<string, FormatError> =>
  Effect.try({
    try: () => {
      // Default values: use the concrete resolved value (not var references)
      const defaultEntries: [string[], TokenValue][] = []
      for (const token of map.values()) {
        defaultEntries.push([token.rawPath, token.value])
      }
      const root = buildNested(defaultEntries)

      // Per-theme objects
      if (themes) {
        const themeObjects: Record<string, Record<string, unknown>> = {}

        for (const [themeName] of Object.entries(themes)) {
          const themeEntries: [string[], TokenValue][] = []
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
          root['$themes'] = themeObjects
        }
      }

      // Per-breakpoint objects
      if (breakpoints) {
        const bpObjects: Record<string, Record<string, unknown>> = {}

        for (const [bpName] of Object.entries(breakpoints)) {
          const bpEntries: [string[], TokenValue][] = []
          for (const token of map.values()) {
            const bv = token.breakpointValues?.[bpName]
            if (bv !== undefined) {
              bpEntries.push([token.rawPath, bv.value])
            }
          }
          if (bpEntries.length > 0) {
            bpObjects[bpName] = buildNested(bpEntries)
          }
        }

        if (Object.keys(bpObjects).length > 0) {
          root['$breakpoints'] = bpObjects
        }
      }

      return JSON.stringify(root, null, 2)
    },
    catch: (cause) => new FormatError({ format: 'json', cause }),
  })
