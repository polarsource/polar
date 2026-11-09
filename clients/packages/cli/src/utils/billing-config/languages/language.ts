import { dirname, join } from 'node:path'
import { Effect, type FileSystem } from 'effect'
import {
  BillingConfigError,
  type ConfigDocument,
  type Format,
  type LoadedConfig,
} from '@/schemas/BillingConfig'
import type { Run } from '@/utils/run'

export interface Installer {
  readonly command: (
    fs: FileSystem.FileSystem,
    root: string,
  ) => Effect.Effect<ReadonlyArray<string>>
  readonly installed: (
    fs: FileSystem.FileSystem,
    root: string,
  ) => Effect.Effect<boolean>
}

export interface Language {
  readonly format: Format
  readonly extension: string
  readonly extensions: ReadonlyArray<string>
  readonly defaultFiles: ReadonlyArray<string>
  readonly manifest: string | undefined
  readonly installer: Installer | undefined
  readonly load: (
    fs: FileSystem.FileSystem,
    run: Run,
    file: string,
  ) => Effect.Effect<LoadedConfig, BillingConfigError>
  readonly render: (
    document: ConfigDocument,
  ) => Effect.Effect<string, BillingConfigError>
}

export const readSource = (fs: FileSystem.FileSystem, file: string) =>
  fs
    .readFileString(file)
    .pipe(
      Effect.mapError(
        () => new BillingConfigError({ message: `Could not read ${file}` }),
      ),
    )

export const exists = (fs: FileSystem.FileSystem, path: string) =>
  fs.exists(path).pipe(Effect.orElseSucceed(() => false))

export const ancestors = (from: string) => {
  const directories = [from]
  for (let parent = dirname(from); parent !== directories.at(-1); ) {
    directories.push(parent)
    parent = dirname(parent)
  }
  return directories
}

export const findUp = (
  fs: FileSystem.FileSystem,
  from: string,
  names: ReadonlyArray<string>,
) =>
  Effect.gen(function* () {
    for (const directory of ancestors(from)) {
      for (const name of names) {
        if (yield* exists(fs, join(directory, name))) return directory
      }
    }
    return undefined
  })

// Export lists unset fields as null; these two mean "one-time" and stay.
const ONE_TIME_NULLS = new Set([
  'recurring_interval',
  'recurring_interval_count',
])

const dropNulls = (item: unknown, keep: ReadonlySet<string>): unknown => {
  if (Array.isArray(item)) return item.map((entry) => dropNulls(entry, keep))
  if (typeof item !== 'object' || item === null) return item
  return Object.fromEntries(
    Object.entries(item)
      .filter(([key, value]) => value !== null || keep.has(key))
      .map(([key, value]) => [key, dropNulls(value, keep)]),
  )
}

export const dropOptionalNulls = (document: ConfigDocument) =>
  dropNulls(document, ONE_TIME_NULLS) as ConfigDocument

export const isEmpty = (document: ConfigDocument) =>
  Object.values(document).every(
    (section) => !Array.isArray(section) || section.length === 0,
  )

export const unwritable =
  (title: string) => (error: BillingConfigError | Error) =>
    new BillingConfigError({
      message: `This config cannot be written as ${title} yet`,
      hint: `Pass --format json instead. ${error.message.split('\n').slice(0, 2).join(' ')}`,
    })
