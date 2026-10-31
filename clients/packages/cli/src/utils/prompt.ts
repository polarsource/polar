import { Console, Effect } from 'effect'
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
