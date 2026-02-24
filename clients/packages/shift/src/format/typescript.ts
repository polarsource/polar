import { Effect } from 'effect'
import type {
  BreakpointConfig,
  FlatTokenMap,
  ResolvedToken,
  ThemeConfig,
  TokenValue,
} from '../types.js'
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

function collectThemeNames(
  map: FlatTokenMap,
  themes?: ThemeConfig,
): string[] {
  const names = new Set<string>()
  if (themes) {
    for (const themeName of Object.keys(themes)) names.add(themeName)
  }
  for (const token of map.values()) {
    if (!token.themeValues) continue
    for (const themeName of Object.keys(token.themeValues)) names.add(themeName)
  }
  return [...names]
}

function buildTokenDefinitions(map: FlatTokenMap): Record<string, Omit<ResolvedToken, 'path'>> {
  const definitions: Record<string, Omit<ResolvedToken, 'path'>> = {}
  for (const token of map.values()) {
    const tokenName = token.rawPath.join('_')
    definitions[tokenName] = {
      rawPath: token.rawPath,
      value: token.value,
      aliasOf: token.aliasOf,
      type: token.type,
      category: token.category,
      description: token.description,
      themeValues: token.themeValues,
      breakpointValues: token.breakpointValues,
    }
  }
  return definitions
}

/**
 * Format a FlatTokenMap as TypeScript `as const` exports.
 *
 * Always emits:
 * ```ts
 * export const tokens = { ... } as const
 * ```
 *
 * When `themes` / `breakpoints` are provided and tokens carry overrides, also emits:
 * ```ts
 * export const themes = { dark: { ... } } as const
 * export const breakpoints = { sm: { ... } } as const
 * ```
 */
export const formatTypescript = (
  map: FlatTokenMap,
  themes?: ThemeConfig,
  breakpoints?: BreakpointConfig,
): Effect.Effect<string, FormatError> =>
  Effect.try({
    try: () => {
      const parts: string[] = []

      // Default tokens
      const defaultEntries: [string[], TokenValue][] = []
      for (const token of map.values()) {
        defaultEntries.push([token.rawPath, token.value])
      }
      parts.push(
        `export const tokens = ${JSON.stringify(buildNested(defaultEntries), null, 2)} as const`,
      )
      parts.push(
        `export const tokenDefinitions = ${JSON.stringify(buildTokenDefinitions(map), null, 2)} as const`,
      )

      // Per-theme objects (inferred from token theme keys unless optional config is provided)
      const themeObjects: Record<string, Record<string, unknown>> = {}
      for (const themeName of collectThemeNames(map, themes)) {
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
        parts.push(
          `export const themes = ${JSON.stringify(themeObjects, null, 2)} as const`,
        )
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
          parts.push(
            `export const breakpoints = ${JSON.stringify(bpObjects, null, 2)} as const`,
          )
        }
      }

      return parts.join('\n\n') + '\n'
    },
    catch: (cause) => new FormatError({ format: 'typescript', cause }),
  })
