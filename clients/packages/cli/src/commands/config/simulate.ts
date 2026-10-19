import { Duration, Effect, Option } from 'effect'
import { Command, Flag } from 'effect/cli'
import { SimulateOutput } from '@/schemas/Simulation'
import { BillingConfig } from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
import { output } from '@/utils/command'
import { configFile as file, org } from '@/utils/flags'
import { setPrices } from '@/utils/price-override'
import { withProgress } from '@/utils/progress'
import { renderSimulation } from '@/utils/simulation'
import { analyze } from '@/utils/simulation-analysis'
import { parseWindow } from '@/utils/simulation-window'

const set = Flag.String('set').pipe(
  Flag.withDescription(
    'Try a fixed price without editing the file, as product.currency=amount, e.g. starter.usd=15. Repeatable',
  ),
  Flag.atLeast(0),
)

const since = Flag.String('since').pipe(
  Flag.withDescription(
    'Start of the replayed window, as a duration back from --until (30d, 3m, 1y) or a date. Defaults to 1 month',
  ),
  Flag.optional,
)

const until = Flag.String('until').pipe(
  Flag.withDescription(
    'End of the replayed window, as a date. Defaults to now',
  ),
  Flag.optional,
)

const churnTolerance = Flag.Finite('churn-tolerance').pipe(
  Flag.withDescription(
    'Price increase, in percent, subscribers accept without churning. Turns on churn estimates; defaults to 20 when only --churn-elasticity is given',
  ),
  Flag.optional,
)

const churnElasticity = Flag.Finite('churn-elasticity').pipe(
  Flag.withDescription(
    'Percent of subscribers who churn for every 10% increase past the tolerance. Turns on churn estimates; defaults to 15 when only --churn-tolerance is given',
  ),
  Flag.optional,
)

export const simulate = Command.make('simulate', {
  file,
  org,
  set,
  since,
  until,
  churnTolerance,
  churnElasticity,
}).pipe(
  Command.withDescription(
    'Replay the subscription orders billed in a window at the prices of a billing config file, without applying it',
  ),
  Command.withExamples([
    {
      command: 'polar config simulate',
      description: 'Simulate polar.config.ts in the current directory',
    },
    {
      command: 'polar config simulate --since 3m',
      description: 'Replay the last three months',
    },
    {
      command: 'polar config simulate --set starter.usd=15 --set pro.usd=45',
      description: 'Try other fixed prices without editing the file',
    },
    {
      command: 'polar config simulate --churn-tolerance 10',
      description: 'Estimate the revenue left after subscribers churn',
    },
    {
      command: 'polar config simulate --json',
      description: 'Print the simulation as JSON',
    },
  ]),
  output({
    result: SimulateOutput,
    run: ({ file, org, set, since, until, churnTolerance, churnElasticity }) =>
      withProgress(
        (progress) =>
          Effect.gen(function* () {
            yield* progress.start('Reading')
            const loaded = yield* (yield* BillingConfig).load(
              Option.getOrUndefined(file),
            )
            yield* progress.finish(loaded.file)
            const config = yield* setPrices(loaded, set)
            const window = yield* parseWindow(since, until)
            if (set.length > 0) {
              yield* progress.start('Setting')
              yield* progress.finish(set.join(', '))
            }
            yield* progress.start('Simulating')
            const [elapsed, { organization, results }] = yield* Effect.timed(
              Effect.gen(function* () {
                const organization = yield* (yield* Organizations).resolve(
                  Option.getOrUndefined(org),
                )
                const results = yield* (yield* BillingConfig).simulate(
                  config,
                  organization,
                  window,
                )
                return { organization, results }
              }),
            )
            yield* progress.finish(
              `${Math.round(Duration.toMillis(elapsed))}ms`,
            )
            const assumptions =
              Option.isNone(churnTolerance) && Option.isNone(churnElasticity)
                ? null
                : {
                    churn_tolerance_pct: Option.getOrElse(
                      churnTolerance,
                      () => 20,
                    ),
                    churn_elasticity_pct: Option.getOrElse(
                      churnElasticity,
                      () => 15,
                    ),
                  }
            return {
              file: config.file,
              set,
              assumptions,
              organization,
              results: analyze(results, assumptions),
            }
          }),
        'columns',
      ),
    render: ({ organization, results, assumptions }) =>
      renderSimulation(organization, results, assumptions),
    json: ({ file, set, assumptions, results }) => ({
      file,
      set,
      assumptions,
      results,
    }),
  }),
)
