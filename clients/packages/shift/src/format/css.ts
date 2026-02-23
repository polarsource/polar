import { Effect, Data } from 'effect'
import type { FlatTokenMap, ThemeConfig } from '../types.js'

export class FormatError extends Data.TaggedError('FormatError')<{
  format: string
  cause: unknown
}> {}

/**
 * Convert a token path to a valid CSS custom-property name.
 * Dots are used as path separators in the token model but are not valid
 * in CSS identifiers, so all dots are replaced with hyphens.
 */
function cssVarName(path: string): string {
  return path.replace(/\./g, '-')
}

/**
 * Resolve the CSS emission value for a token value.
 * If the token was an alias (aliasOf is set), emit var(--aliased-path).
 * Otherwise emit the concrete value directly.
 */
function cssValue(value: string | number, aliasOf?: string): string {
  if (aliasOf) {
    return `var(--${cssVarName(aliasOf)})`
  }
  return String(value)
}

/**
 * Format a FlatTokenMap as CSS custom properties.
 *
 * - `:root { }` contains ALL tokens at their default values.
 * - One block per theme in `themes` containing only tokens that have an override
 *   for that theme.
 *
 * Tokens that alias another token emit `var(--target)` rather than the concrete
 * value, preserving the proxy relationship at runtime.
 */
export const formatCss = (
  map: FlatTokenMap,
  themes?: ThemeConfig,
): Effect.Effect<string, FormatError> =>
  Effect.try({
    try: () => {
      const blocks: string[] = []

      // :root block — all tokens
      const rootLines: string[] = [':root {']
      for (const token of map.values()) {
        rootLines.push(`  --${cssVarName(token.path)}: ${cssValue(token.value, token.aliasOf)};`)
      }
      rootLines.push('}')
      blocks.push(rootLines.join('\n'))

      // One block per theme — only tokens with an override for that theme
      if (themes) {
        for (const [themeName, selector] of Object.entries(themes)) {
          const themeLines: string[] = []

          for (const token of map.values()) {
            const tv = token.themeValues?.[themeName]
            if (tv === undefined) continue
            themeLines.push(
              `  --${cssVarName(token.path)}: ${cssValue(tv.value, tv.aliasOf)};`,
            )
          }

          if (themeLines.length > 0) {
            blocks.push(`${selector} {\n${themeLines.join('\n')}\n}`)
          }
        }
      }

      return blocks.join('\n\n')
    },
    catch: (cause) => new FormatError({ format: 'css', cause }),
  })
