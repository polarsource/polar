import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { generateConfig } from '@polar-sh/polar'
import { Effect, type FileSystem } from 'effect'
import { BillingConfigError, CONFIG_FILES } from '@/schemas/BillingConfig'
import {
  ancestors,
  dropOptionalNulls,
  exists,
  type Installer,
  type Language,
  readSource,
  unwritable,
} from '@/services/billing-config/languages/language'
import { locateInScript } from '@/services/billing-config/languages/typescript/locate'
import { removeFromScript } from '@/services/billing-config/languages/typescript/remove'

const PACKAGE = '@polar-sh/polar'
const MANIFEST = 'package.json'

const MANAGERS = ['pnpm', 'yarn', 'bun', 'npm'] as const
type PackageManager = (typeof MANAGERS)[number]

const LOCKFILES: ReadonlyArray<readonly [string, PackageManager]> = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['package-lock.json', 'npm'],
]

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const

const MISSING_PACKAGE = /Cannot find package '([^']+)'/

interface Position {
  readonly line: number
  readonly column: number
}

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

const isManager = (value: string): value is PackageManager =>
  (MANAGERS as ReadonlyArray<string>).includes(value)

const declaredManager = (fs: FileSystem.FileSystem, root: string) =>
  fs.readFileString(join(root, MANIFEST)).pipe(
    Effect.map((source) => {
      const manifest = JSON.parse(source) as { packageManager?: unknown }
      const declared =
        typeof manifest.packageManager === 'string'
          ? manifest.packageManager.split('@')[0]!
          : ''
      return isManager(declared) ? declared : undefined
    }),
    Effect.orElseSucceed(() => undefined),
  )

const detectPackageManager = (fs: FileSystem.FileSystem, root: string) =>
  Effect.gen(function* () {
    for (const directory of ancestors(root)) {
      for (const [lockfile, manager] of LOCKFILES) {
        if (yield* exists(fs, join(directory, lockfile))) return manager
      }
      const declared = yield* declaredManager(fs, directory)
      if (declared !== undefined) return declared
    }
    return 'npm'
  })

const installer: Installer = {
  command: (fs, root) =>
    Effect.map(detectPackageManager(fs, root), (manager) =>
      manager === 'npm'
        ? ['npm', 'install', PACKAGE]
        : [manager, 'add', PACKAGE],
    ),
  installed: (fs, root) =>
    fs.readFileString(join(root, MANIFEST)).pipe(
      Effect.map((source) => {
        const manifest = JSON.parse(source) as Partial<
          Record<(typeof DEPENDENCY_FIELDS)[number], Record<string, unknown>>
        >
        return DEPENDENCY_FIELDS.some(
          (field) => PACKAGE in (manifest[field] ?? {}),
        )
      }),
      Effect.orElseSucceed(() => false),
    ),
}

export const typescript: Language = {
  title: 'TypeScript',
  format: 'ts',
  extension: '.ts',
  extensions: ['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs'],
  defaultFiles: CONFIG_FILES.ts,
  manifest: MANIFEST,
  installer,
  load: (fs, file) =>
    Effect.gen(function* () {
      const source = yield* readSource(fs, file)
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
    }),
  render: (document) =>
    generateConfig(dropOptionalNulls(document)).pipe(
      Effect.mapError(unwritable('TypeScript')),
    ),
  locate: ({ source, input }, path, got) =>
    locateInScript(source, input, path, got),
  remove: ({ source }, removals) => removeFromScript(source, removals),
}
