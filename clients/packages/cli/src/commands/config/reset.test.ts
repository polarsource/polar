import { describe, expect, test, vi } from 'vitest'
import { Cause, Effect, Exit } from 'effect'
import { reset } from '@/commands/config/reset'
import { BillingConfigError } from '@/schemas/BillingConfig'
import { Auth } from '@/services/auth'
import {
  BillingConfig,
  type ResetPending,
  type ResetResult,
} from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
import { keys, runCli, stripAnsi } from '@/utils/test-utils/cli'
import { fakeAuth, fakeOrganizations } from '@/utils/test-utils/services'

const acme = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  environment: 'sandbox' as const,
}

const pending: ResetPending = { file: 'polar.config.ts', source: 'draft' }

const run = async (
  args: ReadonlyArray<string> = [],
  options: Parameters<typeof runCli>[2] = {},
  result: ResetResult = { ...pending, status: 'reset' },
) => {
  const written = vi.fn()
  const cli = runCli(reset, args, options)
  const exit = await Effect.runPromiseExit(
    cli.effect.pipe(
      Effect.provideService(
        BillingConfig,
        BillingConfig.of({
          generate: () => Effect.die('unused'),
          load: () => Effect.die('unused'),
          plan: () => Effect.die('unused'),
          apply: () => Effect.die('unused'),
          deprecations: () => Effect.die('unused'),
          prune: () => Effect.die('unused'),
          catalogs: () => Effect.die('unused'),
          publish: () => Effect.die('unused'),
          init: () => Effect.die('unused'),
          install: () => Effect.die('unused'),
          disable: () => Effect.die('unused'),
          reset: (_organization, _file, approve) =>
            result.status === 'unchanged'
              ? Effect.succeed(result)
              : approve(result).pipe(
                  Effect.tap(() => Effect.sync(written)),
                  Effect.as(result),
                ),
        }),
      ),
      Effect.provideService(Auth, fakeAuth().auth),
      Effect.provideService(
        Organizations,
        fakeOrganizations({
          items: [acme],
          selected: { id: acme.id, environment: acme.environment },
        }).organizations,
      ),
    ),
  )
  return {
    output: stripAnsi(cli.output()),
    terminal: stripAnsi(cli.terminal()),
    written: written.mock.calls.length,
    exit,
  }
}

const message = (exit: Exit.Exit<unknown, unknown>) =>
  Exit.isFailure(exit)
    ? (Cause.squash(exit.cause) as BillingConfigError).message
    : undefined

describe('polar config reset', () => {
  test('rewrites the file with --confirm', async () => {
    const { output, written, exit } = await run(['--confirm'])
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(written).toBe(1)
    expect(output).toContain(
      'polar.config.ts now matches the draft of Acme (sandbox)',
    )
  })

  test('says which catalog it came from when there is no draft', async () => {
    const { output } = await run(
      ['--confirm'],
      {},
      {
        file: 'polar.config.ts',
        source: 'live',
        status: 'reset',
      },
    )
    expect(output).toContain(
      'polar.config.ts now matches the live catalog of Acme (sandbox)',
    )
  })

  test('rewrites the file after confirmation', async () => {
    const { terminal, output, written } = await run([], {
      interactive: true,
      input: [...keys.type('y'), keys.enter],
    })
    expect(output).toContain(
      'polar.config.ts is rewritten from the draft of Acme (sandbox).',
    )
    expect(terminal).toContain('Overwrite polar.config.ts?')
    expect(written).toBe(1)
  })

  test('keeps the file when declined', async () => {
    const { written, exit } = await run([], {
      interactive: true,
      input: [...keys.type('n'), keys.enter],
    })
    expect(written).toBe(0)
    expect(message(exit)).toBe('Reset cancelled, nothing changed')
  })

  test('needs --confirm when there is no terminal to ask', async () => {
    const { written, exit } = await run()
    expect(written).toBe(0)
    expect(message(exit)).toBe(
      'Confirmation needed to overwrite polar.config.ts',
    )
  })

  test('says so when the file already matches', async () => {
    const { output, written, exit } = await run(
      [],
      {},
      {
        ...pending,
        status: 'unchanged',
      },
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(written).toBe(0)
    expect(output).toContain(
      'polar.config.ts already matches the draft of Acme (sandbox)',
    )
  })

  test('prints the result as JSON', async () => {
    const { output } = await run(['--confirm', '--json'])
    expect(JSON.parse(output)).toEqual({
      file: 'polar.config.ts',
      source: 'draft',
      status: 'reset',
    })
  })
})
