import { describe, expect, test, vi } from 'vitest'
import { Cause, Effect, Exit } from 'effect'
import { disable } from '@/commands/config/disable'
import { BillingConfigError } from '@/schemas/BillingConfig'
import { Auth } from '@/services/auth'
import { BillingConfig } from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
import { keys, runCli, stripAnsi } from '@/utils/test-utils/cli'
import { fakeAuth, fakeOrganizations } from '@/utils/test-utils/services'

const acme = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  environment: 'sandbox' as const,
}

const run = async (
  args: ReadonlyArray<string> = [],
  options: Parameters<typeof runCli>[2] = {},
) => {
  const disabled = vi.fn((_organization: unknown) => Effect.void)
  const cli = runCli(disable, args, options)
  const exit = await Effect.runPromiseExit(
    cli.effect.pipe(
      Effect.provideService(
        BillingConfig,
        BillingConfig.of({
          load: () => Effect.die('unused'),
          plan: () => Effect.die('unused'),
          apply: () => Effect.die('unused'),
          deprecations: () => Effect.die('unused'),
          prune: () => Effect.die('unused'),
          catalogs: () => Effect.die('unused'),
          publish: () => Effect.die('unused'),
          init: () => Effect.die('unused'),
          install: () => Effect.die('unused'),
          disable: disabled,
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
    disabled: disabled.mock.calls.length,
    exit,
  }
}

const message = (exit: Exit.Exit<unknown, unknown>) =>
  Exit.isFailure(exit)
    ? (Cause.squash(exit.cause) as BillingConfigError).message
    : undefined

describe('polar config disable', () => {
  test('disables config with --confirm', async () => {
    const { output, disabled, exit } = await run(['--confirm'])
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(disabled).toBe(1)
    expect(output).toContain('Config is disabled for Acme (sandbox)')
    expect(output).toContain('Your config file was left untouched')
  })

  test('disables config after confirmation', async () => {
    const { terminal, disabled } = await run([], {
      interactive: true,
      input: [...keys.type('y'), keys.enter],
    })
    expect(terminal).toContain('Disable config for Acme (sandbox)?')
    expect(disabled).toBe(1)
  })

  test('keeps config when declined', async () => {
    const { disabled, exit } = await run([], {
      interactive: true,
      input: [...keys.type('n'), keys.enter],
    })
    expect(disabled).toBe(0)
    expect(message(exit)).toBe('Disable cancelled, nothing changed')
  })

  test('needs --confirm when there is no terminal to ask', async () => {
    const { disabled, exit } = await run()
    expect(disabled).toBe(0)
    expect(message(exit)).toBe(
      'Confirmation needed to disable config for Acme (sandbox)',
    )
  })
})
