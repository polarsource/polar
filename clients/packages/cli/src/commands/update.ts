import { Console, Effect } from 'effect'
import { Command } from 'effect/unstable/cli'
import {
  type CLIRelease,
  getLatestRelease,
  isNewerVersion,
} from '@/services/github-releases'
import { install, type InstallStep } from '@/services/update'
import * as ui from '@/utils/ui'
import { VERSION } from '@/version'

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
    yield* install(release, binaryPath, (step) =>
      Console.log(ui.step(messages[step])),
    )
    yield* Console.log(ui.blank)
    yield* Console.log(
      ui.success(
        `Updated ${ui.dim(VERSION)} ${ui.dim('→')} ${ui.bold(ui.cyan(latestVersion))}`,
      ),
    )
    yield* Console.log(ui.blank)
  })

export const update = Command.make('update', {}, () =>
  Effect.gen(function* () {
    yield* Console.log(ui.blank)
    yield* Console.log(ui.step('Checking for updates...'))

    const release = yield* getLatestRelease

    const latestVersion = release.version

    if (!isNewerVersion(latestVersion, VERSION)) {
      yield* Console.log(ui.success(`Already up to date ${ui.dim(VERSION)}`))
      yield* Console.log(ui.blank)
      return
    }

    yield* downloadAndUpdate(release, latestVersion, process.execPath)
  }),
).pipe(Command.withDescription('Update the CLI to the latest release'))
