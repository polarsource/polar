import { Duration, Effect, Option } from 'effect'
import { Command } from 'effect/cli'
import type { ActiveOrganization } from '@/schemas/Auth'
import { SimulateOutput, type SimulationResult } from '@/schemas/Simulation'
import { BillingConfig } from '@/services/billing-config/service'
import { Simulation } from '@/services/simulation'
import { Organizations } from '@/services/organizations'
import { money } from '@/utils/billing-config/describe'
import { target } from '@/utils/billing-config/review'
import { output } from '@/utils/command'
import { configFile as file, org } from '@/utils/flags'
import { withProgress } from '@/utils/progress'
import * as ui from '@/utils/ui'

const signed = (amount: number, currency: string) =>
  `${amount < 0 ? '-' : '+'}${money(Math.abs(amount), currency)}`

const renderResult = ({
  monthly_delta,
  currency,
  counts,
  cohorts,
  not_simulated,
}: SimulationResult) => [
  `${ui.INDENT}${ui.bold(`${signed(monthly_delta, currency)}/mo`)} ${ui.dim(
    `${counts.more} pay more, ${counts.less} pay less, ${counts.same} the same, ${counts.no_history} no history`,
  )}`,
  ...cohorts.map((cohort) => {
    const delta = cohort.proposed_monthly - cohort.baseline_monthly
    return `${ui.INDENT}${ui.INDENT}${[
      cohort.product_external_id,
      cohort.price_label,
      `${cohort.subscribers} ${cohort.subscribers === 1 ? 'subscriber' : 'subscribers'}`,
      `${signed(delta / cohort.subscribers, currency)}/mo each`,
      `${signed(delta, currency)}/mo`,
    ].join(ui.dim(' · '))}`
  }),
  ...(not_simulated.length > 0
    ? [
        ui.blank,
        `${ui.INDENT}${ui.dim('Not simulated')}`,
        ...not_simulated.map(
          (item) =>
            `${ui.INDENT}${ui.INDENT}${item.external_id} ${ui.dim(item.reason)}`,
        ),
      ]
    : []),
]

const render = (
  organization: ActiveOrganization,
  results: ReadonlyArray<SimulationResult>,
) =>
  results.length === 0
    ? [ui.success(`No subscribers in ${target(organization)} to simulate`)]
    : [
        `${ui.INDENT}${ui.dim('Simulation')} ${target(organization)}`,
        ...results.flatMap((result) => [ui.blank, ...renderResult(result)]),
      ]

export const simulate = Command.make('simulate', { file, org }).pipe(
  Command.withDescription(
    'Show what a billing config file would change in what your subscribers pay, without applying it',
  ),
  Command.withExamples([
    {
      command: 'polar config simulate',
      description: 'Simulate polar.config.ts in the current directory',
    },
    {
      command: 'polar config simulate --json',
      description: 'Print the simulation as JSON',
    },
  ]),
  output({
    result: SimulateOutput,
    run: ({ file, org }) =>
      withProgress(
        (progress) =>
          Effect.gen(function* () {
            yield* progress.start('Reading')
            const config = yield* (yield* BillingConfig).load(
              Option.getOrUndefined(file),
            )
            yield* progress.finish(config.file)
            yield* progress.start('Simulating')
            const [elapsed, { organization, results }] = yield* Effect.timed(
              Effect.gen(function* () {
                const organization = yield* (yield* Organizations).resolve(
                  Option.getOrUndefined(org),
                )
                const results = yield* (yield* Simulation).simulate(
                  config,
                  organization,
                )
                return { organization, results }
              }),
            )
            yield* progress.finish(
              `${Math.round(Duration.toMillis(elapsed))}ms`,
            )
            return { config, organization, results }
          }),
        'columns',
      ),
    render: ({ organization, results }) => render(organization, results),
    json: ({ config, results }) => ({ file: config.file, results }),
  }),
)
