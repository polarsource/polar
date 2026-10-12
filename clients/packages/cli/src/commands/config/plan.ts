import { Duration, Effect, Option } from 'effect'
import { Command } from 'effect/cli'
import type { ActiveOrganization } from '@/schemas/Auth'
import {
  BillingConfigError,
  type LoadedConfig,
  type PlanResult,
  PlanOutput,
} from '@/schemas/BillingConfig'
import { BillingConfig } from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
import { planSummary } from '@/utils/billing-config/entries'
import {
  changes,
  errors,
  found,
  summary,
  target,
  unchanged,
} from '@/utils/billing-config/review'
import { output } from '@/utils/command'
import { configFile as file, org } from '@/utils/flags'
import { withProgress } from '@/utils/progress'
import * as ui from '@/utils/ui'

const render = (
  config: LoadedConfig,
  organization: ActiveOrganization,
  result: PlanResult,
) => [
  ...changes(config, organization, result),
  ui.blank,
  ...(result.issues.length > 0
    ? [summary(result.issues)]
    : unchanged(result.entries)
      ? [ui.success(`${target(organization)} is up to date, nothing to apply`)]
      : [
          planSummary(result.entries),
          `${ui.INDENT}${ui.dim('Run')} ${ui.command('polar config apply')} ${ui.dim('to apply it.')}`,
        ]),
]

export const plan = Command.make('plan', { file, org }).pipe(
  Command.withDescription(
    'Show what applying a billing config file would change, without applying it',
  ),
  Command.withExamples([
    {
      command: 'polar config plan',
      description: 'Check polar.config.ts in the current directory',
    },
    {
      command: 'polar config plan billing/polar.json',
      description: 'Check a specific file',
    },
    {
      command: 'polar config plan --org acme',
      description: 'Check against another organization, by slug or ID',
    },
    {
      command: 'polar config plan --json',
      description: 'Print the changes and issues as JSON',
    },
  ]),
  output({
    result: PlanOutput,
    run: ({ file, org }) =>
      Effect.gen(function* () {
        const billing = yield* BillingConfig
        return yield* withProgress(
          (progress) =>
            Effect.gen(function* () {
              yield* progress.start('Reading')
              const config = yield* billing.load(Option.getOrUndefined(file))
              yield* progress.finish(config.file)
              yield* progress.start('Found')
              yield* progress.finish(found(config))
              yield* progress.start('Comparing')
              const [elapsed, { organization, result }] = yield* Effect.timed(
                Effect.gen(function* () {
                  const organization = yield* (yield* Organizations).resolve(
                    Option.getOrUndefined(org),
                  )
                  const result = yield* billing.plan(config, organization)
                  return { organization, result }
                }),
              )
              yield* progress.finish(
                `${Math.round(Duration.toMillis(elapsed))}ms`,
              )
              return { config, organization, result }
            }),
          'columns',
        )
      }),
    render: ({ config, organization, result }) =>
      render(config, organization, result),
    json: ({ config, result }) => ({ file: config.file, ...result }),
    failed: ({ config, result }) =>
      errors(result.issues) > 0
        ? new BillingConfigError({
            message: `${config.file} cannot be applied`,
          })
        : undefined,
  }),
)
