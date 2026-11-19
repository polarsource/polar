import { Effect } from 'effect'
import { packageOf } from '@/commands/config/init/report'
import {
  output as ranOutput,
  type Run,
} from '@/services/billing-config/service'
import type { Progress } from '@/utils/progress'
import { confirm } from '@/utils/prompt'
import * as ui from '@/utils/ui'

const confirmInstall = (
  command: ReadonlyArray<string>,
  prompt: boolean,
  skip: boolean,
) =>
  skip
    ? Effect.succeed(false)
    : prompt
      ? confirm(
          `Install ${packageOf(command)} with ${ui.command(command.join(' '))} now?`,
        )
      : Effect.succeed(true)

export const installPackage = (
  run: Run,
  command: ReadonlyArray<string> | undefined,
  directory: string,
  prompt: boolean,
  skip: boolean,
  progress: Progress,
  say: (lines: ReadonlyArray<string>) => Effect.Effect<void>,
) =>
  Effect.gen(function* () {
    if (command === undefined) return undefined
    const text = command.join(' ')
    if (!(yield* confirmInstall(command, prompt, skip))) {
      return { command: text, status: 'skipped' } as const
    }
    yield* progress.start(`Installing ${packageOf(command)}`)
    const ran = yield* run(command, directory)
    yield* ran.ok ? progress.finish(text) : progress.fail(text)
    const printed = ranOutput(ran)
    if (!ran.ok && printed) {
      yield* say([ui.blank, ...printed.split('\n').map(ui.step)])
    }
    return { command: text, status: ran.ok ? 'installed' : 'failed' } as const
  })
