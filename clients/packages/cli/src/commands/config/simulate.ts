import { Duration, Effect, Option } from 'effect'
import { Command } from 'effect/cli'
import { SimulateOutput } from '@/schemas/Simulation'
import { BillingConfig } from '@/services/billing-config/service'
import { Simulation } from '@/services/simulation'
import { Organizations } from '@/services/organizations'
import { output } from '@/utils/command'
import { configFile as file, org } from '@/utils/flags'
import { withProgress } from '@/utils/progress'
import { renderSimulation } from '@/utils/simulation'

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
    render: ({ organization, results }) =>
      renderSimulation(organization, results),
    json: ({ config, results }) => ({ file: config.file, results }),
  }),
)
