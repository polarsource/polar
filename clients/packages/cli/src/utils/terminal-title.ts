import { Effect, Stdio } from 'effect'
import { isJson } from '@/utils/output'
import * as ui from '@/utils/ui'

export const withTerminalTitle = <A, E, R>(
  title: string,
  effect: Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const stdio = yield* Stdio.Stdio
    if ((yield* isJson) || !(yield* stdio.stdoutIsTerminal)) {
      return yield* effect
    }
    return yield* Effect.acquireUseRelease(
      Effect.sync(() => process.stdout.write(ui.pushTitle(title))),
      () => effect,
      () => Effect.sync(() => process.stdout.write(ui.popTitle)),
    )
  })
