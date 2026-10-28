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
import { commentOnPullRequest } from '@/services/pull-request-comment'
import { planMarkdown } from '@/utils/billing-config/markdown'
import {
  errors,
  fixErrors,
  found,
  next,
  overview,
  runApply,
  sections,
  target,
  unchanged,
} from '@/utils/billing-config/review'
import { output } from '@/utils/command'
import { configFile as file, org } from '@/utils/flags'
import { withProgress } from '@/utils/progress'
import { commented, prComment } from '@/utils/pull-request-comment'
import * as ui from '@/utils/ui'

const render = (
  config: LoadedConfig,
  organization: ActiveOrganization,
  result: PlanResult,
) => [
  ...sections(config, result),
  ...overview(config, organization, result),
  ...(errors(result.issues) > 0
    ? next(fixErrors(result.issues))
    : unchanged(result.entries)
      ? [
          ui.blank,
          ui.success(`${target(organization)} is up to date, nothing to apply`),
        ]
      : next(runApply)),
  ui.blank,
]

export const plan = Command.make('plan', { file, org, prComment }).pipe(
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
    {
      command: 'polar config plan --pr-comment',
      description:
        'Also post the plan on the pull request being built, in GitHub Actions or Buildkite',
    },
  ]),
  output({
    result: PlanOutput,
    run: ({ file, org, prComment }, { say }) =>
      Effect.gen(function* () {
        const billing = yield* BillingConfig
        const planned = yield* withProgress(
          (progress) =>
            Effect.gen(function* () {
              yield* progress.open('Preflight')
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
        if (prComment) {
          const { config, organization, result } = planned
          const posted = yield* commentOnPullRequest(
            `config plan ${organization.id} ${config.file}`,
            planMarkdown(config, organization, result),
          )
          yield* say([commented(posted)])
        }
        return planned
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
