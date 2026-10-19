import { describe, expect, test } from 'vitest'
import { Effect } from 'effect'
import { FetchHttpClient } from 'effect/http'
import { simulate } from '@/commands/config/simulate'
import type { LoadedConfig } from '@/schemas/BillingConfig'
import type { SimulationResponse } from '@/schemas/Simulation'
import { Environment } from '@/services/api'
import { Auth } from '@/services/auth'
import { BillingConfig } from '@/services/billing-config/service'
import { Simulation } from '@/services/simulation'
import { Organizations } from '@/services/organizations'
import { runCli, stripAnsi } from '@/utils/test-utils/cli'
import { fakeAuth, fakeOrganizations } from '@/utils/test-utils/services'

const config: LoadedConfig = {
  file: 'polar.json',
  source: '{}',
  input: {},
  generated: false,
}

const acme = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  environment: 'sandbox' as const,
}

const results: SimulationResponse = [
  {
    monthly_delta: 168_000 + 1_000,
    currency: 'usd',
    counts: { more: 169, less: 0, same: 0, no_history: 2 },
    cohorts: [
      {
        product_external_id: 'pro',
        price_label: '$15.00',
        subscribers: 168,
        baseline_monthly: 252_000,
        proposed_monthly: 420_000,
        components: [],
      },
      {
        product_external_id: 'pro',
        price_label: '$10.00',
        subscribers: 1,
        baseline_monthly: 1_000,
        proposed_monthly: 2_000,
        components: [],
      },
    ],
    not_simulated: [
      {
        resource: 'product',
        external_id: 'team',
        reason: "seat based prices aren't supported yet.",
      },
    ],
  },
]

const run = async (response: SimulationResponse, args: string[] = []) => {
  const cli = runCli(simulate, ['polar.json', ...args])
  const exit = await Effect.runPromiseExit(
    cli.effect.pipe(
      Effect.provideService(
        BillingConfig,
        BillingConfig.of({
          load: () => Effect.succeed(config),
          plan: () => Effect.die('unused'),
          apply: () => Effect.die('unused'),
          pull: () => Effect.die('unused'),
        }),
      ),
      Effect.provideService(
        Simulation,
        Simulation.of({ simulate: () => Effect.succeed(response) }),
      ),
      Effect.provideService(Auth, fakeAuth().auth),
      Effect.provideService(
        Organizations,
        fakeOrganizations({
          items: [acme],
          selected: { id: acme.id, environment: acme.environment },
        }).organizations,
      ),
      Effect.provideService(Environment, {}),
      Effect.provide(FetchHttpClient.layer),
    ),
  )
  return { output: stripAnsi(cli.output()), failed: exit._tag === 'Failure' }
}

describe('polar config simulate', () => {
  test('shows the monthly delta, cohorts and what was not simulated', async () => {
    const { output, failed } = await run(results)
    expect(failed).toBe(false)
    expect(output).toContain(
      [
        '  Simulation Acme (sandbox)',
        '',
        '  +$1,690/mo 169 pay more, 0 pay less, 0 the same, 2 no history',
        '    pro · $15.00 · 168 subscribers · +$10/mo each · +$1,680/mo',
        '    pro · $10.00 · 1 subscriber · +$10/mo each · +$10/mo',
        '',
        '  Not simulated',
        "    team seat based prices aren't supported yet.",
      ].join('\n'),
    )
  })

  test('says so when there is nothing to simulate', async () => {
    const { output } = await run([])
    expect(output).toContain('No subscribers in Acme (sandbox) to simulate')
  })

  test('prints the results as JSON', async () => {
    const { output } = await run(results, ['--json'])
    expect(JSON.parse(output)).toEqual({ file: 'polar.json', results })
  })
})
