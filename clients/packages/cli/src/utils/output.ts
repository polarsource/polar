import { Effect } from 'effect'
import { Flag, GlobalFlag } from 'effect/cli'

export const Output = GlobalFlag.Setting('output')({
  flag: Flag.Boolean('json').pipe(
    Flag.withDefault(false),
    Flag.withDescription('Print the result as JSON'),
    Flag.map((json) => ({ json })),
  ),
})

export const isJson = Effect.serviceOption(Output).pipe(
  Effect.map((output) => output._tag === 'Some' && output.value.json),
)
