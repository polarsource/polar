import { extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Effect, type FileSystem } from 'effect'
import {
  BillingConfigError,
  DEFAULT_CONFIG_FILES,
  type LoadedConfig,
} from '@/schemas/BillingConfig'

const SCRIPT_EXTENSIONS = new Set([
  '.ts',
  '.mts',
  '.cts',
  '.js',
  '.mjs',
  '.cjs',
])

interface Position {
  readonly line: number
  readonly column: number
}

const MISSING_PACKAGE = /Cannot find package '([^']+)'/

const positionOf = (error: unknown): Position | undefined => {
  const position =
    typeof error === 'object' && error !== null && 'position' in error
      ? (error.position as Partial<Position> | null)
      : undefined
  return typeof position?.line === 'number' &&
    typeof position.column === 'number'
    ? { line: position.line, column: position.column }
    : undefined
}

export const loadFailure = (file: string, error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  const missing = MISSING_PACKAGE.exec(message)?.[1]
  if (missing !== undefined) {
    return new BillingConfigError({
      message: `Could not load ${file}`,
      hint: `It imports ${missing}, which is not installed. Run npm install ${missing}.`,
    })
  }
  const position = positionOf(error)
  if (position !== undefined) {
    return new BillingConfigError({
      message: `Could not parse ${file}:${position.line}:${position.column}`,
      hint: message,
    })
  }
  return new BillingConfigError({
    message: `Could not load ${file}`,
    hint: message,
  })
}

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
      catch: (error) => loadFailure(file, error),
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

  const exists = (file: string) =>
    fs.exists(file).pipe(Effect.orElseSucceed(() => false))

  const findDefault = Effect.gen(function* () {
    for (const name of DEFAULT_CONFIG_FILES) {
      if (yield* exists(name)) return name
    }
    return yield* new BillingConfigError({
      message: 'No billing config file found in the current directory',
      hint: `Looked for ${DEFAULT_CONFIG_FILES.join(', ')}. Pass a path to use another file.`,
    })
  })

  return (file?: string): Effect.Effect<LoadedConfig, BillingConfigError> =>
    Effect.gen(function* () {
      const resolved = file ?? (yield* findDefault)
      if (!(yield* exists(resolved))) {
        return yield* new BillingConfigError({
          message: `${resolved} does not exist`,
        })
      }
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
