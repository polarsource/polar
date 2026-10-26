import { extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Effect, type FileSystem } from 'effect'
import {
  BillingConfigError,
  DEFAULT_CONFIG_FILES,
  type LoadedConfig,
} from '@/schemas/BillingConfig'
import { Environment } from '@/services/api'
import { isCompiledBinary } from '@/services/telemetry'

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

const evaluateInProcess = async (url: string) => {
  const module = (await import(url)) as { default?: unknown }
  return typeof module.default === 'function'
    ? ((await module.default()) as unknown)
    : module.default
}

const RESULT_MARKER = '__polar_config_result__'

const childScript = (url: string) => `
const marker = '\\n' + ${JSON.stringify(RESULT_MARKER)}
try {
  const module = await import(${JSON.stringify(url)})
  const value = typeof module.default === 'function' ? await module.default() : module.default
  console.log(marker + JSON.stringify({ value }))
} catch (error) {
  const position = error?.position
  console.log(marker + JSON.stringify({
    error: {
      message: error instanceof Error ? error.message : String(error),
      position: position ? { line: position.line, column: position.column } : null,
    },
  }))
}
`

interface ChildResult {
  readonly value?: unknown
  readonly error?: {
    readonly message: string
    readonly position: Position | null
  }
}

// Runs this executable as plain Bun, which resolves the config's imports from
// its node_modules like `bun polar.config.ts` would.
export const evaluateInSubprocess = async (
  url: string,
  env: Record<string, string | undefined>,
) => {
  const child = Bun.spawn([process.execPath, '-e', childScript(url)], {
    env: { ...env, BUN_BE_BUN: '1' },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  const line = stdout
    .split('\n')
    .reverse()
    .find((candidate) => candidate.startsWith(RESULT_MARKER))
  if (line === undefined) {
    throw new Error(
      stderr.trim() || `Evaluating the config exited with ${child.exitCode}`,
    )
  }
  const result = JSON.parse(line.slice(RESULT_MARKER.length)) as ChildResult
  if (result.error !== undefined) {
    const { message, position } = result.error
    throw Object.assign(new Error(message), { position })
  }
  return result.value
}

const loadScript = (fs: FileSystem.FileSystem, file: string) =>
  Effect.gen(function* () {
    const source = yield* fs
      .readFileString(file)
      .pipe(
        Effect.mapError(
          () => new BillingConfigError({ message: `Could not read ${file}` }),
        ),
      )
    const env = yield* Environment
    const url = pathToFileURL(resolve(file)).href
    const exported = yield* Effect.tryPromise({
      // A compiled binary ignores package.json when resolving imports of a
      // file loaded at runtime, so only packages with a root index.js load.
      // https://github.com/oven-sh/bun/issues/46412
      try: () =>
        isCompiledBinary()
          ? evaluateInSubprocess(url, env)
          : evaluateInProcess(url),
      catch: (error) => loadFailure(file, error),
    })
    const json = JSON.stringify(exported) as string | undefined
    if (json === undefined || !json.startsWith('{')) {
      return yield* new BillingConfigError({
        message: `${file} does not default export a billing config`,
        hint: 'Export the config object or a function returning it with `export default`.',
      })
    }
    return {
      file,
      source,
      input: JSON.parse(json) as unknown,
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
      if (SCRIPT_EXTENSIONS.has(extension)) {
        return yield* loadScript(fs, resolved)
      }
      if (extension === '.json' || extension === '') {
        return yield* loadJson(resolved)
      }
      return yield* new BillingConfigError({
        message: `${resolved} is not a supported config file`,
        hint: `Use a .json, .ts or .js file.`,
      })
    })
}
