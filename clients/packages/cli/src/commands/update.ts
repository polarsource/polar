import { Console, Effect, Option } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import {
  type CLIRelease,
  getLatestRelease,
  isNewerVersion,
} from '@/services/github-releases'
import { install, type InstallStep, UpdateError } from '@/services/update'
import { type PackageManager, Updater, methods } from '@/services/updater'
import * as ui from '@/utils/ui'
import { VERSION } from '@/version'

const progress = (latestVersion: string): Record<InstallStep, string> => ({
  download: `Downloading ${latestVersion}...`,
  verify: 'Verifying checksum...',
  extract: 'Extracting...',
  replace: 'Replacing binary...',
})

const updated = (latestVersion: string) =>
  Effect.gen(function* () {
    yield* Console.log(ui.blank)
    yield* Console.log(
      ui.success(
        `Updated ${ui.dim(VERSION)} ${ui.dim('→')} ${ui.bold(ui.cyan(latestVersion))}`,
      ),
    )
    yield* Console.log(ui.blank)
  })

export const downloadAndUpdate = (
  release: CLIRelease,
  latestVersion: string,
  binaryPath: string,
) =>
  Effect.gen(function* () {
    const messages = progress(latestVersion)
    yield* install(release, binaryPath, (step) =>
      Console.log(ui.step(messages[step])),
    )
    yield* updated(latestVersion)
  })

const upToDate = Effect.gen(function* () {
  yield* Console.log(ui.success(`Already up to date ${ui.dim(VERSION)}`))
  yield* Console.log(ui.blank)
})

const updateBinary = Effect.gen(function* () {
  const release = yield* getLatestRelease
  if (!isNewerVersion(release.version, VERSION)) return yield* upToDate
  yield* downloadAndUpdate(release, release.version, process.execPath)
})

const updateWithPackageManager = (method: PackageManager) =>
  Effect.gen(function* () {
    const updater = yield* Updater
    const latestVersion = yield* updater.latest
    if (!isNewerVersion(latestVersion, VERSION)) return yield* upToDate

    yield* Console.log(ui.step(`Updating with ${method}...`))
    yield* Console.log(ui.blank)
    yield* updater.upgrade(method, latestVersion)
    yield* updated(latestVersion)
  })

export const update = Command.make(
  'update',
  {
    method: Flag.Literals('method', methods).pipe(
      Flag.optional,
      Flag.withDescription(
        'How the CLI was installed: binary (install.sh), npm, pnpm, bun, yarn or vp (Vite+). Detected when omitted',
      ),
    ),
  },
  ({ method }) =>
    Effect.gen(function* () {
      yield* Console.log(ui.blank)
      yield* Console.log(ui.step('Checking for updates...'))

      const updater = yield* Updater
      const detected = Option.getOrUndefined(method) ?? (yield* updater.detect)
      if (!detected) {
        return yield* new UpdateError({
          message: `Could not detect how the CLI was installed. Pass --method with one of ${methods.join(', ')}.`,
        })
      }

      if (detected === 'binary') return yield* updateBinary
      yield* updateWithPackageManager(detected)
    }),
).pipe(Command.withDescription('Update the CLI to the latest release'))
