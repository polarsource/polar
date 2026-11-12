import { Console, Effect, Stdio } from 'effect'
import { Prompt } from 'effect/cli'
import * as ui from '@/utils/ui'

const theme = { prefix: `${ui.INDENT}?`, pointer: `${ui.INDENT}❯` }

interface SelectOptions<A> {
  readonly message: string
  readonly choices: ReadonlyArray<Prompt.SelectChoice<A>>
}

export const select = <A>(
  options: SelectOptions<A>,
  label: (value: A) => string,
) =>
  Prompt.run(Prompt.Select({ ...options, theme })).pipe(
    Effect.tap((value) => answered(options.message, label(value))),
  )

export const confirm = (message: string, initial = true) =>
  Prompt.run(Prompt.Confirm({ message, initial, theme })).pipe(
    Effect.tap((value) => answered(message, value ? 'Yes' : 'No')),
  )

const answered = (message: string, value: string) =>
  Console.log(
    `${ui.clearLines(2)}${ui.INDENT}${ui.green('✔')} ${message}\n${ui.INDENT}${ui.INDENT}${ui.dim(value)}`,
  )

export const interactive = Effect.gen(function* () {
  const stdio = yield* Stdio.Stdio
  return (yield* stdio.stdinIsTerminal) && (yield* stdio.stdoutIsTerminal)
})

export const keypress = (frame: string) =>
  Prompt.Custom<boolean, boolean>(false, {
    render: (_, action) =>
      Effect.succeed(
        action._tag === 'NextFrame'
          ? frame
          : action._tag === 'Submit'
            ? `${frame}\n`
            : '',
      ),
    process: (input) =>
      Effect.succeed(
        input.key.name === 'y'
          ? { _tag: 'Submit', value: true }
          : input.key.name === 'n' || input.key.name === 'escape'
            ? { _tag: 'Submit', value: false }
            : { _tag: 'Beep' },
      ),
    clear: () => Effect.succeed(ui.clearLines(frame.split('\n').length)),
  })
