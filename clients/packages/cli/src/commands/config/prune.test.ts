import { describe, expect, test, vi } from 'vitest'
import { Cause, Effect, Exit } from 'effect'
import { prune } from '@/commands/config/prune'
import {
  BillingConfigError,
  type LoadedConfig,
  type PruneEntry,
} from '@/schemas/BillingConfig'
import { Auth } from '@/services/auth'
import { BillingConfig } from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
import { keys, runCli, stripAnsi } from '@/utils/test-utils/cli'
import { fakeAuth, fakeOrganizations } from '@/utils/test-utils/services'

const config: LoadedConfig = {
  file: 'polar.json',
  source: '{}',
  input: {
    meters: [{ external_id: 'apples' }],
    benefits: [{ external_id: 'beta' }],
    products: [{ external_id: 'legacy' }],
  },
  generated: false,
}

const acme = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  environment: 'sandbox' as const,
}

const apples: PruneEntry = {
  resource: 'meter',
  external_id: 'apples',
  customer_count: 0,
  referenced_by: [],
}
const beta: PruneEntry = {
  resource: 'benefit',
  external_id: 'beta',
  customer_count: 3,
  referenced_by: ['legacy'],
}
const legacy: PruneEntry = {
  resource: 'product',
  external_id: 'legacy',
  customer_count: 1,
  referenced_by: [],
}

const run = async (
  entries: ReadonlyArray<PruneEntry>,
  args: ReadonlyArray<string> = [],
  options: Parameters<typeof runCli>[2] = {},
) => {
  const removed = vi.fn()
  const cli = runCli(prune, ['polar.json', ...args], options)
  const exit = await Effect.runPromiseExit(
    cli.effect.pipe(
      Effect.provideService(
        BillingConfig,
        BillingConfig.of({
          load: () => Effect.succeed(config),
          plan: () => Effect.die('unused'),
          apply: () => Effect.die('unused'),
          pull: () => Effect.die('unused'),
          prune: (_config, _organization, confirm) =>
            entries.some(
              (entry) =>
                entry.customer_count === 0 && entry.referenced_by.length === 0,
            )
              ? confirm(entries).pipe(
                  Effect.tap(() => Effect.sync(() => removed())),
                  Effect.as({ entries, removed: true }),
                )
              : Effect.succeed({ entries, removed: false }),
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
    removed: removed.mock.calls.length,
    exit,
  }
}

const message = (exit: Exit.Exit<unknown, unknown>) =>
  Exit.isFailure(exit)
    ? (Cause.squash(exit.cause) as BillingConfigError).message
    : undefined

describe('polar config prune', () => {
  test('removes only the unused entries with --confirm', async () => {
    const { output, removed, exit } = await run(
      [apples, beta, legacy],
      ['--confirm'],
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(removed).toBe(1)
    expect(output).toMatch(/ {2}Deprecated Acme \(sandbox\)\n {2}╭─+╮\n/)
    expect(output).toMatch(/│ {2}Remove *│\n {2}│ {2}- meter {4}apples *│\n/)
    expect(output).toMatch(
      new RegExp(
        [
          '│ {2}Keep, still in use *│',
          ' {2}│ {2}= benefit {2}beta {4}3 customers, used by product legacy *│',
          ' {2}│ {2}= product {2}legacy {2}1 customer *│',
        ].join('\n'),
      ),
    )
    expect(output).toContain(
      'polar.json: 1 entry removed, nothing changed on Polar',
    )
  })

  test('asks before removing and keeps the file when declined', async () => {
    const { terminal, removed, exit } = await run([apples], [], {
      interactive: true,
      input: [...keys.type('n'), keys.enter],
    })
    expect(terminal).toContain('Remove 1 entry from polar.json?')
    expect(removed).toBe(0)
    expect(message(exit)).toBe('Prune cancelled, polar.json unchanged')
  })

  test('needs --confirm when there is no terminal to ask', async () => {
    const { removed, exit } = await run([apples])
    expect(removed).toBe(0)
    expect(message(exit)).toBe(
      'Confirmation needed to remove entries from polar.json',
    )
  })

  test('does not ask when everything is still in use', async () => {
    const { output, removed, exit } = await run([beta])
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(removed).toBe(0)
    expect(output).toContain('Nothing to remove')
  })

  test('reports when nothing is deprecated', async () => {
    const { output } = await run([])
    expect(output).toContain('No deprecated entries in polar.json')
  })
})
