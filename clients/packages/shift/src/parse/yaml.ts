import { Effect, Data } from 'effect'
import { readFileSync } from 'node:fs'
import { parse as parseYaml } from 'yaml'
import type { TokenGroup } from '../types.js'

export class ParseError extends Data.TaggedError('ParseError')<{
  file: string
  cause: unknown
}> {}

export const parseYamlFile = (
  file: string,
): Effect.Effect<TokenGroup, ParseError> =>
  Effect.try({
    try: () => {
      const content = readFileSync(file, 'utf-8')
      const parsed = parseYaml(content) as TokenGroup
      if (parsed === null || typeof parsed !== 'object') {
        throw new Error('YAML root must be an object')
      }
      return parsed
    },
    catch: (cause) => new ParseError({ file, cause }),
  })
