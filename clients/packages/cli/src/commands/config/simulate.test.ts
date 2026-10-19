import { describe, expect, test } from 'vitest'
import { Effect } from 'effect'
import { FetchHttpClient } from 'effect/http'
import { simulate } from '@/commands/config/simulate'
import type { LoadedConfig } from '@/schemas/BillingConfig'
import type { SimulationResponse } from '@/schemas/Simulation'
import { Environment } from '@/services/api'
import { Auth } from '@/services/auth'
import { BillingConfig } from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
import { runCli, stripAnsi } from '@/utils/test-utils/cli'
import { fakeAuth, fakeOrganizations } from '@/utils/test-utils/services'

const config: LoadedConfig = {
  file: 'polar.json',
  source: '{}',
  input: {
    products: [
      {
        external_id: 'pro',
        prices: [
          { amount_type: 'fixed', price_currency: 'usd', price_amount: 2500 },
        ],
      },
    ],
  },
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
    window: {
      since: '2026-07-19T00:00:00Z',
      until: '2026-10-19T00:00:00Z',
      months: 3,
    },
    currency: 'usd',
    baseline: 756_000 + 3_000,
    proposed: 1_260_000 + 6_000,
    monthly_delta: 169_000,
    counts: { more: 169, less: 0, same: 0, no_history: 2, not_simulated: 3 },
    breakdown: [
      {
        product_external_id: 'pro',
        price_label: '$15.00',
        archived: false,
        partial: false,
        recurring_interval: 'month',
        recurring_interval_count: 1,
        subscribers: 168,
        baseline: 756_000,
        proposed: 1_260_000,
        components: [],
      },
      {
        product_external_id: 'pro',
        price_label: '$10.00',
        archived: true,
        partial: true,
        recurring_interval: 'year',
        recurring_interval_count: 1,
        subscribers: 1,
        baseline: 3_000,
        proposed: 6_000,
        components: [],
      },
    ],
    not_simulated: [
      {
        resource: 'product',
        external_id: 'team',
        reason: "seat-based prices aren't supported yet",
        subscribers: 3,
      },
      {
        resource: 'product',
        external_id: 'pro',
        reason: 'nothing billed in the window',
        subscribers: 2,
      },
    ],
  },
]

const run = async (response: SimulationResponse, args: string[] = []) => {
  const cli = runCli(simulate, ['polar.json', ...args])
  const windows: unknown[] = []
  await Effect.runPromiseExit(
    cli.effect.pipe(
      Effect.provideService(
        BillingConfig,
        BillingConfig.of({
          load: () => Effect.succeed(config),
          plan: () => Effect.die('unused'),
          apply: () => Effect.die('unused'),
          pull: () => Effect.die('unused'),
          simulate: (_config, _organization, window) => {
            windows.push(window)
            return Effect.succeed(response)
          },
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
      Effect.provideService(Environment, {}),
      Effect.provide(FetchHttpClient.layer),
    ),
  )
  return { output: stripAnsi(cli.output()), windows }
}

describe('polar config simulate', () => {
  test('shows the window totals, breakdown and what was not simulated', async () => {
    const { output } = await run(results)
    expect(output).toContain(
      [
        '  ╭─ Simulation Acme (sandbox) · Jul 19 – Oct 19, 2026',
        '  │',
        '  │         subscribers   billed → proposed    change',
        '  │ usd                                       +$5,070    +67%',
        '  │   pro           168    $7,560 → $12,600   +$5,040    +67%',
        '  │                   1           $30 → $60      +$30   +100%   archived price · billed yearly · other charges not simulated',
        '  │',
        '  ╰─',
        '',
        "  ▲ Not simulated for team (3 subscribers): seat-based prices aren't supported yet",
        '  ▲ Not simulated for pro (2 subscribers): nothing billed in the window',
        '',
        '  Simulation: USD +$5,070 (≈ +$1,690/mo)',
        '  169 pay more, 5 not simulated. Replays subscription orders billed Jul 19 – Oct 19, 2026 at the proposed prices.',
      ].join('\n'),
    )
  })

  test('passes the window to the server', async () => {
    const { windows } = await run(results, [
      '--since',
      '3m',
      '--until',
      '2026-10-19',
    ])
    expect(windows).toEqual([
      { since: '2026-07-19T00:00:00.000Z', until: '2026-10-19T00:00:00.000Z' },
    ])
  })

  test('estimates the revenue left after churn', async () => {
    const { output } = await run(results, ['--churn-tolerance', '50'])
    expect(output).toContain(
      [
        '  │         subscribers   billed → proposed    change           churn risk',
        '  │ usd                                       +$5,070    +67%',
        '  │   pro           168    $7,560 → $12,600   +$5,040    +67%          25%',
        '  │                   1           $30 → $60      +$30   +100%          75%   archived price · billed yearly · other charges not simulated',
      ].join('\n'),
    )
    expect(output).toContain(
      [
        '  Expected after churn: USD +$625/mo (169 subscribers at risk)',
        '  Assumes subscribers accept up to 50% more, then 15% churn for every further 10%.',
      ].join('\n'),
    )
  })
})
