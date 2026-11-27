import { Console, Effect, Stdio, Terminal } from 'effect'
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

const submittedRows = (message: string, answer: string) =>
  Math.ceil(
    Bun.stringWidth(`✔ ${message} …  ${answer}`) /
      (process.stdout.columns || 80),
  )

export const multiSelect = <A>(options: SelectOptions<A>) =>
  Effect.gen(function* () {
    const terminal = yield* Terminal.Terminal
    yield* Effect.ignore(terminal.display('\n'))
    const picked = yield* Prompt.run(
      Prompt.MultiSelect({
        ...options,
        theme: { ...theme, checkboxOn: '◉', checkboxOff: '○' },
      }),
    )
    const answer = options.choices
      .filter((choice) => picked.includes(choice.value))
      .map((choice) => choice.title)
      .join(', ')
    yield* Effect.ignore(
      terminal.display(
        ui.clearLines(submittedRows(options.message, answer) + 2),
      ),
    )
    return picked
  })

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

const keyAction = (key: string): Prompt.Action<boolean, boolean> => {
  if (key === 'y') return { _tag: 'Submit', value: true }
  if (key === 'n' || key === 'escape') return { _tag: 'Submit', value: false }
  return { _tag: 'Beep' }
}

export const keypress = (frame: string) =>
  Prompt.Custom<boolean, boolean>(false, {
    render: (_, action) => {
      if (action._tag === 'NextFrame') return Effect.succeed(frame)
      return Effect.succeed(action._tag === 'Submit' ? `${frame}\n` : '')
    },
    process: (input) => Effect.succeed(keyAction(input.key.name)),
    clear: () => Effect.succeed(ui.clearLines(frame.split('\n').length)),
  })
