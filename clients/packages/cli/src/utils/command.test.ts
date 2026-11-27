import { describe, expect, test } from 'vitest'
import { Effect, Exit, Schema } from 'effect'
import { Command } from 'effect/cli'
import { output, textOnly } from '@/utils/command'
import { Usage, type UsageValue } from '@/utils/usage'
import { runCli } from '@/utils/test-utils/cli'

const token = (opened: string[]) =>
  Command.make('token').pipe(
    textOnly({
      reason: 'the token goes straight into your env file and is never printed',
      run: (_, { say }) =>
        Effect.gen(function* () {
          yield* say(['Opening your browser to create a token...'])
          opened.push('token page')
          return '.env.local'
        }),
      render: (envFile) => [`Added POLAR_ACCESS_TOKEN to ${envFile}`],
    }),
  )

describe('textOnly', () => {
  test('prints progress and the result as text', async () => {
    const opened: string[] = []
    const cli = runCli(token(opened), [])
    const exit = await Effect.runPromiseExit(cli.effect)
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(cli.output()).toBe(
      'Opening your browser to create a token...\nAdded POLAR_ACCESS_TOKEN to .env.local',
    )
  })

  test('refuses --json with its reason, before opening the browser', async () => {
    const opened: string[] = []
    const cli = runCli(token(opened), ['--json'])
    const exit = await Effect.runPromiseExit(cli.effect)
    expect(exit).toMatchObject({
      cause: {
        reasons: [
          {
            error: {
              _tag: 'JsonUnsupportedError',
              message:
                "The token command doesn't support --json: the token goes straight into your env file and is never printed",
            },
          },
        ],
      },
    })
    expect(opened).toEqual([])
    expect(cli.output()).toBe('')
  })
})

test('output records what the command says about its result', async () => {
  const usage: Record<string, UsageValue> = {}
  const save = Command.make('save').pipe(
    output({
      result: Schema.Struct({ saved: Schema.Finite }),
      run: () => Effect.succeed({ saved: 2 }),
      render: ({ saved }) => [`Saved ${saved}`],
      telemetry: ({ saved }) => ({
        config_status: 'saved',
        config_updated: saved,
      }),
    }),
  )
  const cli = runCli(save, [])
  await Effect.runPromise(cli.effect.pipe(Effect.provideService(Usage, usage)))
  expect(usage).toEqual({ config_status: 'saved', config_updated: 2 })
})
