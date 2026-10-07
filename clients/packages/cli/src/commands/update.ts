import { Effect, Option, Schema } from 'effect'
import { Command, Flag } from 'effect/cli'
import {
  type CLIRelease,
  getLatestRelease,
  isNewerVersion,
} from '@/services/github-releases'
import { install, type InstallStep, UpdateError } from '@/services/update'
import {
  type Method,
  type PackageManager,
  Updater,
  methods,
} from '@/services/updater'
import { output } from '@/utils/command'
import { note } from '@/utils/progress'
import * as ui from '@/utils/ui'
import { VERSION } from '@/version'

const Outcome = Schema.Struct({
  method: Schema.Literals(methods),
  current: Schema.String,
  latest: Schema.String,
  updated: Schema.Boolean,
})
type Outcome = typeof Outcome.Type

const progress = (latestVersion: string): Record<InstallStep, string> => ({
  download: `Downloading ${latestVersion}...`,
  verify: 'Verifying checksum...',
  extract: 'Extracting...',
  replace: 'Replacing binary...',
})

export const downloadAndUpdate = (
  release: CLIRelease,
  latestVersion: string,
  binaryPath: string,
) =>
  Effect.gen(function* () {
    const messages = progress(latestVersion)
    yield* install(release, binaryPath, (step) => note(ui.step(messages[step])))
  })

const outcome = (
  method: Method,
  latest: string,
  updated: boolean,
): Outcome => ({ method, current: VERSION, latest, updated })

const updateBinary = Effect.gen(function* () {
  const release = yield* getLatestRelease
  if (!isNewerVersion(release.version, VERSION)) {
    return outcome('binary', release.version, false)
  }
  yield* downloadAndUpdate(release, release.version, process.execPath)
  return outcome('binary', release.version, true)
})

const updateWithPackageManager = (method: PackageManager) =>
  Effect.gen(function* () {
    const updater = yield* Updater
    const latestVersion = yield* updater.latest
    if (!isNewerVersion(latestVersion, VERSION)) {
      return outcome(method, latestVersion, false)
    }
    yield* note(ui.step(`Updating with ${method}...`))
    yield* note(ui.blank)
    yield* updater.upgrade(method, latestVersion)
    return outcome(method, latestVersion, true)
  })

export const update = Command.make('update', {
  method: Flag.Literals('method', methods).pipe(
    Flag.optional,
    Flag.withDescription(
      'How the CLI was installed: binary (install.sh), npm, pnpm, bun, yarn or vp (Vite+). Detected when omitted',
    ),
  ),
}).pipe(
  Command.withDescription('Update the CLI to the latest release'),
  output({
    result: Outcome,
    run: ({ method }) =>
      Effect.gen(function* () {
        yield* note(ui.blank)
        yield* note(ui.step('Checking for updates...'))
        const updater = yield* Updater
        const detected =
          Option.getOrUndefined(method) ?? (yield* updater.detect)
        if (!detected) {
          return yield* new UpdateError({
            message: `Could not detect how the CLI was installed. Pass --method with one of ${methods.join(', ')}.`,
          })
        }
        return yield* detected === 'binary'
          ? updateBinary
          : updateWithPackageManager(detected)
      }),
    render: ({ current, latest, updated }: Outcome) =>
      updated
        ? [
            ui.blank,
            ui.success(
              `Updated ${ui.dim(current)} ${ui.dim('→')} ${ui.bold(ui.cyan(latest))}`,
            ),
            ui.blank,
          ]
        : [ui.success(`Already up to date ${ui.dim(current)}`), ui.blank],
  }),
)
