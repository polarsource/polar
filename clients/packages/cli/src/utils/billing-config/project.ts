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

const ancestors = (from: string) => {
  const directories = [from]
  for (let parent = dirname(from); parent !== directories.at(-1); ) {
    directories.push(parent)
    parent = dirname(parent)
  }
  return directories
}

export const findProjectRoot = (fs: FileSystem.FileSystem, from: string) =>
  Effect.gen(function* () {
    for (const directory of ancestors(from)) {
      if (yield* exists(fs, join(directory, 'package.json'))) return directory
    }
    return undefined
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
    for (const directory of ancestors(root)) {
      for (const [lockfile, manager] of LOCKFILES) {
        if (yield* exists(fs, join(directory, lockfile))) return manager
      }
      const declared = yield* declaredManager(fs, directory)
      if (declared !== undefined) return declared
    }
    return 'npm'
  })

export const isInstalled = (fs: FileSystem.FileSystem, root: string) =>
  Effect.gen(function* () {
    for (const directory of ancestors(root)) {
      const manifest = join(directory, 'node_modules', PACKAGE, 'package.json')
      if (yield* exists(fs, manifest)) return true
    }
    return false
  })
