import { Console, Effect } from 'effect'
import { Command } from 'effect/unstable/cli'
import { getLatestRelease, isNewerVersion } from '@/services/github-releases'
import { downloadAndUpdate, type UpdateStep } from '@/services/update'
import * as ui from '@/utils/ui'
import { VERSION } from '@/version'

const stepLabels: Record<UpdateStep, (version: string) => string> = {
  download: (version) => `Downloading ${version}...`,
  verify: () => 'Verifying checksum...',
  extract: () => 'Extracting...',
  replace: () => 'Replacing binary...',
}

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

    yield* downloadAndUpdate(release, process.execPath, (step) =>
      Console.log(ui.step(stepLabels[step](latestVersion))),
    )

    yield* Console.log(ui.blank)
    yield* Console.log(
      ui.success(
        `Updated ${ui.dim(VERSION)} ${ui.dim('→')} ${ui.bold(ui.cyan(latestVersion))}`,
      ),
    )
    yield* Console.log(ui.blank)
  }),
).pipe(Command.withDescription('Update the CLI to the latest release'))
