import { dirname, join } from 'node:path'
import { Effect, type FileSystem } from 'effect'

export const PACKAGE = '@polar-sh/polar'

export const MANAGERS = ['pnpm', 'yarn', 'bun', 'npm'] as const
export type PackageManager = (typeof MANAGERS)[number]

const LOCKFILES: ReadonlyArray<readonly [string, PackageManager]> = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['package-lock.json', 'npm'],
]

export const installCommand = (manager: PackageManager) =>
  manager === 'npm' ? ['npm', 'install', PACKAGE] : [manager, 'add', PACKAGE]

export const exists = (fs: FileSystem.FileSystem, path: string) =>
  fs.exists(path).pipe(Effect.orElseSucceed(() => false))

export const findProjectRoot = (fs: FileSystem.FileSystem, from: string) =>
  Effect.gen(function* () {
    let directory = from
    while (true) {
      if (yield* exists(fs, join(directory, 'package.json'))) return directory
      const parent = dirname(directory)
      if (parent === directory) return undefined
      directory = parent
    }
  })

const isManager = (value: string): value is PackageManager =>
  (MANAGERS as ReadonlyArray<string>).includes(value)

const declaredManager = (fs: FileSystem.FileSystem, root: string) =>
  fs.readFileString(join(root, 'package.json')).pipe(
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

export const detectPackageManager = (fs: FileSystem.FileSystem, root: string) =>
  Effect.gen(function* () {
    for (const [lockfile, manager] of LOCKFILES) {
      if (yield* exists(fs, join(root, lockfile))) return manager
    }
    return (yield* declaredManager(fs, root)) ?? 'npm'
  })

export const isInstalled = (fs: FileSystem.FileSystem, root: string) =>
  exists(fs, join(root, 'node_modules', PACKAGE, 'package.json'))
