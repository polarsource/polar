import { Command, Options } from '@effect/cli'
import { Effect } from 'effect'
import fg from 'fast-glob'
import { parseYamlFile } from '../parse/yaml.js'
import { resolveAliases } from '../resolve/aliases.js'
import type { TokenGroup } from '../types.js'

const inputOption = Options.text('input').pipe(
  Options.withAlias('i'),
  Options.withDescription('Glob pattern for YAML token files'),
  Options.withDefault('tokens/**/*.yaml'),
)

export const validateCommand = Command.make(
  'validate',
  { input: inputOption },
  ({ input }) =>
    Effect.gen(function* () {
      const files = yield* Effect.tryPromise({
        try: () => fg(input, { dot: false }),
        catch: (e) => new Error(`Failed to expand glob "${input}": ${String(e)}`),
      })

      if (files.length === 0) {
        yield* Effect.log(`No files matched pattern: ${input}`)
        return
      }

      yield* Effect.log(`Validating ${files.length} file(s)...`)

      const groups: TokenGroup[] = yield* Effect.all(
        files.map((file) => parseYamlFile(file)),
      )

      const merged: TokenGroup = Object.assign({}, ...groups)
      yield* resolveAliases(merged)

      yield* Effect.log(`All tokens are valid.`)
    }),
).pipe(Command.withDescription('Validate design token YAML files without writing output'))
