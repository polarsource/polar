import { Effect, Stdio } from 'effect'
import { Flag, GlobalFlag } from 'effect/cli'
import { Environment, detectAgent } from '@/utils/agent'

export const NonInteractive = GlobalFlag.Setting('nonInteractive')({
  flag: Flag.Boolean('non-interactive').pipe(
    Flag.withDefault(false),
    Flag.withDescription(
      'Never prompt or animate, as in scripts and CI. The default when stdin is not a terminal or a coding agent is detected',
    ),
    Flag.map((nonInteractive) => ({ nonInteractive })),
  ),
})

const forced = Effect.serviceOption(NonInteractive).pipe(
  Effect.map(
    (setting) => setting._tag === 'Some' && setting.value.nonInteractive,
  ),
)

export const interactive = Effect.gen(function* () {
  if (yield* forced) return false
  if (detectAgent(yield* Environment) !== undefined) return false
  const stdio = yield* Stdio.Stdio
  return (yield* stdio.stdinIsTerminal) && (yield* stdio.stdoutIsTerminal)
})
