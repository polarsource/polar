import { describe, expect, test } from 'vitest'
import { Effect, Stdio } from 'effect'
import { Environment } from '@/utils/agent'
import { NonInteractive, interactive } from '@/utils/interactive'

const decide = (
  terminal: boolean,
  env: Record<string, string> = {},
  flag?: boolean,
) =>
  Effect.runPromise(
    interactive.pipe(
      flag === undefined
        ? (effect) => effect
        : Effect.provideService(NonInteractive, { nonInteractive: flag }),
      Effect.provideService(Environment, env),
      Effect.provide(
        Stdio.layerTest({
          stdinIsTerminal: Effect.succeed(terminal),
          stdoutIsTerminal: Effect.succeed(terminal),
        }),
      ),
    ),
  )

describe('interactive', () => {
  test('is true on a terminal with no agent around', async () => {
    expect(await decide(true)).toBe(true)
  })

  test('is false without a terminal', async () => {
    expect(await decide(false)).toBe(false)
  })

  test('is false when a coding agent runs the command', async () => {
    expect(await decide(true, { CLAUDECODE: '1' })).toBe(false)
  })

  test('is false when --non-interactive is passed', async () => {
    expect(await decide(true, {}, true)).toBe(false)
  })
})
