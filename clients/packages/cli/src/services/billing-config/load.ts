import { extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Effect, type FileSystem } from 'effect'
import { BillingConfigError, type LoadedConfig } from '@/schemas/BillingConfig'

const SCRIPT_EXTENSIONS = new Set([
  '.ts',
  '.mts',
  '.cts',
  '.js',
  '.mjs',
  '.cjs',
])

const DEFAULT_FILES = [
  'polar.config.ts',
  'polar.config.mts',
  'polar.config.cts',
  'polar.config.js',
  'polar.config.mjs',
  'polar.config.cjs',
  'polar.config.json',
  'polar.json',
]

const loadScript = (file: string) =>
  Effect.gen(function* () {
    const exported = yield* Effect.tryPromise({
      try: async () => {
        const module = (await import(pathToFileURL(resolve(file)).href)) as {
          default?: unknown
        }
        return typeof module.default === 'function'
          ? ((await module.default()) as unknown)
          : module.default
      },
      catch: (error) =>
        new BillingConfigError({
          message: `Could not load ${file}`,
          hint: error instanceof Error ? error.message : String(error),
        }),
    })
    const source = JSON.stringify(exported, null, 2) as string | undefined
    if (source === undefined || !source.startsWith('{')) {
      return yield* new BillingConfigError({
        message: `${file} does not default export a billing config`,
        hint: 'Export the config object or a function returning it with `export default`.',
      })
    }
    return {
      file,
      source,
      input: JSON.parse(source) as unknown,
      generated: true,
    }
  })

export const loader = (fs: FileSystem.FileSystem) => {
  const loadJson = (file: string) =>
    Effect.gen(function* () {
      const source = yield* fs
        .readFileString(file)
        .pipe(
          Effect.mapError(
            () => new BillingConfigError({ message: `Could not read ${file}` }),
          ),
        )
      const input = yield* Effect.try({
        try: () => JSON.parse(source) as unknown,
        catch: (error) =>
          new BillingConfigError({
            message: `${file} is not valid JSON`,
            hint: error instanceof Error ? error.message : String(error),
          }),
      })
      return { file, source, input, generated: false }
    })

  const findDefault = Effect.gen(function* () {
    for (const name of DEFAULT_FILES) {
      if (yield* fs.exists(name).pipe(Effect.orElseSucceed(() => false))) {
        return name
      }
    }
    return yield* new BillingConfigError({
      message: 'No billing config file found in the current directory',
      hint: `Looked for ${DEFAULT_FILES.join(', ')}. Pass a path to use another file.`,
    })
  })

  return (file?: string): Effect.Effect<LoadedConfig, BillingConfigError> =>
    Effect.gen(function* () {
      const resolved = file ?? (yield* findDefault)
      const extension = extname(resolved)
      if (SCRIPT_EXTENSIONS.has(extension)) return yield* loadScript(resolved)
      if (extension === '.json' || extension === '') {
        return yield* loadJson(resolved)
      }
      return yield* new BillingConfigError({
        message: `${resolved} is not a supported config file`,
        hint: `Use a .json, .ts or .js file.`,
      })
    })
}
