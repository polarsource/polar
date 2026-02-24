import { Effect } from 'effect'
import type { FlatTokenMap } from '../types.js'
import { FormatError } from './css.js'

/** Build a nested object from a flat token map's rawPaths */
function buildNested(
  entries: Iterable<[string[], string]>,
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
 * Format a FlatTokenMap as TypeScript `as const` where every leaf value is
 * a CSS custom-property reference (`var(--token-name)`) rather than the
 * resolved concrete value.
 *
 * This lets consumers use tokens as Tailwind arbitrary values:
 * ```tsx
 * const { button } = useOrbit()
 * // button.primary.background === 'var(--button-primary-background)'
 * // → className="bg-[var(--button-primary-background)]"
 * ```
 *
 * Theming is handled entirely by CSS — no runtime merging needed.
 */
export const formatTypescriptVars = (
  map: FlatTokenMap,
): Effect.Effect<string, FormatError> =>
  Effect.try({
    try: () => {
      const entries: [string[], string][] = []
      for (const token of map.values()) {
        const varName = token.rawPath.join('-')
        entries.push([token.rawPath, `var(--${varName})`])
      }
      return (
        `export const tokens = ${JSON.stringify(buildNested(entries), null, 2)} as const\n`
      )
    },
    catch: (cause) => new FormatError({ format: 'ts-vars', cause }),
  })
