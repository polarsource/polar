import { describe, expect, test } from 'vitest'
import { Console, Effect, Stdio } from 'effect'
import { Output } from '@/utils/output'
import { withProgress } from '@/utils/progress'
import { captureConsole, stripAnsi } from '@/utils/test-utils/cli'
import * as ui from '@/utils/ui'

const run = async (step: Effect.Effect<void, string>) => {
  const { lines, console } = captureConsole()
  await Effect.runPromiseExit(
    withProgress(
      (progress) =>
        Effect.gen(function* () {
          yield* progress.open('Preflight')
          yield* progress.start('Comparing')
          yield* step
          yield* progress.finish('done')
        }),
      'columns',
    ).pipe(
      Effect.provideService(Console.Console, console),
      Effect.provideService(Output, { json: false }),
      Effect.provide(
        Stdio.layerTest({
          stdinIsTerminal: Effect.succeed(false),
          stdoutIsTerminal: Effect.succeed(false),
        }),
      ),
    ),
  )
  return stripAnsi(lines.join('\n'))
}

describe('withProgress', () => {
  test('lists steps under a numbered heading, without a box, for humans', async () => {
    ui.setHuman(true)
    const output = await run(Effect.void).finally(() => ui.setHuman(false))
    expect(output).toMatch(/\n {2}01 {2}Preflight\n {6}Comparing ·+ done$/)
  })

  test('closes the box after the last step', async () => {
    expect(await run(Effect.void)).toMatch(
      /│ {2}Comparing {2}done *│\n {2}╰─+╯$/,
    )
  })

  test('marks the running step when the command fails', async () => {
    expect(await run(Effect.fail('boom'))).toMatch(
      /│ {2}Comparing {2}failed *│\n {2}╰─+╯$/,
    )
  })

  test('marks the running step when the command is interrupted', async () => {
    expect(await run(Effect.interrupt)).toMatch(
      /│ {2}Comparing {2}cancelled *│\n {2}╰─+╯$/,
    )
  })
})
