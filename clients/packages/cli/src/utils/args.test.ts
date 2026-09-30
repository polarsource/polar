import { describe, expect, test } from 'vitest'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { joinDashValues } from '@/utils/args'
import { runCli } from '@/utils/test-utils/cli'

describe('joinDashValues', () => {
  test('attaches a value that starts with a dash to the flag before it', () => {
    expect(
      joinDashValues(['orders', 'list', '--sorting', '-created_at']),
    ).toEqual(['orders', 'list', '--sorting=-created_at'])
    expect(joinDashValues(['--amount', '-5', '--limit', '10'])).toEqual([
      '--amount=-5',
      '--limit',
      '10',
    ])
  })

  test('leaves real flags alone', () => {
    const args = ['listen', '--sandbox', '-h', '--org', '--help', '-d=-1']
    expect(joinDashValues(args)).toEqual(args)
  })

  test('leaves flags that already have a value alone', () => {
    const args = ['--sorting=name', '-created_at', '--limit', '5', '-name']
    expect(joinDashValues(args)).toEqual(args)
  })

  test('leaves everything after the separator alone', () => {
    const args = ['trigger', '--name', '--', '-value', '--flag', '-other']
    expect(joinDashValues(args)).toEqual(args)
  })

  test('lets the parser read descending sorts and negative numbers', async () => {
    let parsed: unknown
    const list = Command.make(
      'list',
      {
        sorting: Flag.Literals('sorting', ['name', '-name']).pipe(
          Flag.atLeast(1),
        ),
        limit: Flag.Int('limit'),
      },
      (config) =>
        Effect.sync(() => {
          parsed = config
        }),
    )
    const args = ['--sorting', '-name', '--sorting', 'name', '--limit', '-1']
    await expect(
      Effect.runPromise(runCli(list, args).effect),
    ).rejects.toBeDefined()
    await Effect.runPromise(runCli(list, joinDashValues(args)).effect)
    expect(parsed).toEqual({ sorting: ['-name', 'name'], limit: -1 })
  })
})
