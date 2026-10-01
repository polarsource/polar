import path from 'node:path'
import { Context, Data, Effect, FileSystem, Layer, Schema } from 'effect'
import { HttpClient, HttpClientResponse } from 'effect/unstable/http'

export const PACKAGE_NAME = '@polar-sh/cli'
export const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME.replaceAll('/', '%2F')}/latest`

export const methods = ['binary', 'npm', 'pnpm', 'bun', 'yarn', 'vp'] as const
export type Method = (typeof methods)[number]
export type PackageManager = Exclude<Method, 'binary'>

export class UpdaterError extends Data.TaggedError('UpdaterError')<{
  message: string
  hint?: string
  cause?: unknown
}> {}

export interface ProcessResult {
  readonly code: number
  readonly stdout: string
  readonly stderr: string
}

export interface ExecOptions {
  readonly timeoutMs?: number
  readonly inherit?: boolean
}

export type Exec = (
  command: ReadonlyArray<string>,
  options?: ExecOptions,
) => Effect.Effect<ProcessResult, UpdaterError>

const text = (stream: unknown) =>
  stream instanceof ReadableStream
    ? new Response(stream).text()
    : Promise.resolve('')

export const exec: Exec = (
  command,
  { timeoutMs = 10_000, inherit = false } = {},
) =>
  Effect.tryPromise({
    try: async () => {
      const child = Bun.spawn([...command], {
        stdin: inherit ? 'inherit' : 'ignore',
        stdout: inherit ? 'inherit' : 'pipe',
        stderr: inherit ? 'inherit' : 'pipe',
      })
      const timer = setTimeout(() => child.kill(), timeoutMs)
      try {
        const [stdout, stderr, code] = await Promise.all([
          text(child.stdout),
          text(child.stderr),
          child.exited,
        ])
        return { code, stdout, stderr }
      } finally {
        clearTimeout(timer)
      }
    },
    catch: (cause) =>
      new UpdaterError({
        message: `Failed to run ${command.join(' ')}`,
        cause,
      }),
  })

interface Manifest {
  readonly name?: string
  readonly bin?: Readonly<Record<string, string>>
}

// The npm package hard-links the platform binary into its own bin directory, so an
// npm-installed CLI runs from <package>/bin and the manifest above it names the package.
export const installedPackage = (
  executable: string = process.execPath,
): Effect.Effect<string | undefined, never, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const resolved = yield* fs.realPath(executable)
    const directory = path.dirname(path.dirname(resolved))
    const source = yield* fs.readFileString(
      path.join(directory, 'package.json'),
    )
    const manifest = yield* Effect.try(() => JSON.parse(source) as Manifest)
    if (manifest.name !== PACKAGE_NAME) return undefined
    const bins = Object.values(manifest.bin ?? {})
    return bins.some((bin) => path.resolve(directory, bin) === resolved)
      ? PACKAGE_NAME
      : undefined
  }).pipe(Effect.orElseSucceed(() => undefined))

const listCommands: ReadonlyArray<{
  readonly method: PackageManager
  readonly command: ReadonlyArray<string>
}> = [
  {
    method: 'npm',
    command: ['npm', 'list', '--global', '--depth=0', PACKAGE_NAME],
  },
  {
    method: 'pnpm',
    command: ['pnpm', 'list', '--global', '--depth=0', PACKAGE_NAME],
  },
  { method: 'bun', command: ['bun', 'pm', 'ls', '--global'] },
  { method: 'yarn', command: ['yarn', 'global', 'list'] },
  { method: 'vp', command: ['vp', 'list', '--global', PACKAGE_NAME] },
]

// Platform packages share the prefix, so require the name to end right after it.
const listsPackage = (output: string) =>
  new RegExp(`${PACKAGE_NAME}(?:[@\\s]|$)`, 'm').test(output)

export const detectMethod = (
  run: Exec = exec,
  executable: string = process.execPath,
): Effect.Effect<Method | undefined, never, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    if (!(yield* installedPackage(executable))) return 'binary'
    const results = yield* Effect.forEach(
      listCommands,
      (check) =>
        run(check.command).pipe(
          Effect.orElseSucceed(() => ({ code: 1, stdout: '', stderr: '' })),
          Effect.map((result) => ({ check, result })),
        ),
      { concurrency: 'unbounded' },
    )
    return results.find(({ result }) => listsPackage(result.stdout))?.check
      .method
  })

const RegistryVersion = Schema.Struct({ version: Schema.String })

export const latestPackageVersion: Effect.Effect<
  string,
  UpdaterError,
  HttpClient.HttpClient
> = Effect.gen(function* () {
  const client = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk)
  const response = yield* client.get(REGISTRY_URL)
  const { version } =
    yield* HttpClientResponse.schemaBodyJson(RegistryVersion)(response)
  return `v${version}`
}).pipe(
  Effect.mapError(
    (cause) =>
      new UpdaterError({
        message: `Could not check npm for the latest ${PACKAGE_NAME} version`,
        cause,
      }),
  ),
)

export const upgradeCommand = (
  method: PackageManager,
  version: string,
): ReadonlyArray<string> => {
  const target = `${PACKAGE_NAME}@${version.replace(/^v/, '')}`
  switch (method) {
    case 'npm':
      return ['npm', 'install', '--global', target]
    case 'pnpm':
      return [
        'pnpm',
        'add',
        '--global',
        `--allow-build=${PACKAGE_NAME}`,
        target,
      ]
    case 'bun':
      return ['bun', 'install', '--global', '--trust', target]
    case 'yarn':
      return ['yarn', 'global', 'add', target]
    case 'vp':
      return ['vp', 'install', '--global', target]
  }
}

// Windows refuses to delete the last link to a running executable, so keep a second
// link alive in a temporary directory while the package manager replaces the binary.
const retainRunningImage = (
  executable: string,
  platform: NodeJS.Platform,
): Effect.Effect<Effect.Effect<void>, never, FileSystem.FileSystem> =>
  platform !== 'win32'
    ? Effect.succeed(Effect.void)
    : Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        // Hard links cannot cross volumes, so keep the link beside the executable.
        const directory = yield* fs.makeTempDirectory({
          directory: path.dirname(executable),
          prefix: 'polar-update-',
        })
        const remove = fs
          .remove(directory, { recursive: true, force: true })
          .pipe(Effect.ignore)
        yield* fs
          .link(executable, path.join(directory, path.basename(executable)))
          .pipe(Effect.tapError(() => remove))
        return remove
      }).pipe(Effect.orElseSucceed((): Effect.Effect<void> => Effect.void))

export const upgradeWithPackageManager = (
  method: PackageManager,
  version: string,
  run: Exec = exec,
  executable: string = process.execPath,
  platform: NodeJS.Platform = process.platform,
): Effect.Effect<void, UpdaterError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const command = upgradeCommand(method, version)
    const release = yield* retainRunningImage(executable, platform)
    const result = yield* Effect.ensuring(
      run(command, { inherit: true, timeoutMs: 5 * 60_000 }),
      release,
    )
    if (result.code !== 0) {
      return yield* new UpdaterError({
        message: `${command.join(' ')} exited with code ${result.code}`,
        hint: 'Fix the issue above, then run polar update again.',
      })
    }
  })

export class Updater extends Context.Service<
  Updater,
  {
    detect: Effect.Effect<Method | undefined>
    latest: Effect.Effect<string, UpdaterError>
    upgrade: (
      method: PackageManager,
      version: string,
    ) => Effect.Effect<void, UpdaterError>
  }
>()('Updater') {}

export const layer = Layer.effect(
  Updater,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const http = yield* HttpClient.HttpClient
    return Updater.of({
      detect: detectMethod().pipe(
        Effect.provideService(FileSystem.FileSystem, fs),
      ),
      latest: latestPackageVersion.pipe(
        Effect.provideService(HttpClient.HttpClient, http),
      ),
      upgrade: (method, version) =>
        upgradeWithPackageManager(method, version).pipe(
          Effect.provideService(FileSystem.FileSystem, fs),
        ),
    })
  }),
)
