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
import { planSummary } from '@/utils/billing-config/entries'
import { formatProblems } from '@/utils/billing-config/problems'
import {
  changes,
  errors,
  found,
  linted,
  summary,
  target,
  unchanged,
} from '@/utils/billing-config/review'
import { output } from '@/utils/command'
import { configFile as file, org } from '@/utils/flags'
import { withProgress } from '@/utils/progress'
import { commented, prComment } from '@/utils/pull-request-comment'
import * as ui from '@/utils/ui'

const problems = (config: LoadedConfig, result: PlanResult) => [
  ui.blank,
  formatProblems(config, result.issues),
  ui.blank,
  summary(result.issues),
]

const outcome = (organization: ActiveOrganization, result: PlanResult) => {
  if (result.issues.length > 0) return [summary(result.issues)]
  if (unchanged(result.entries)) {
    return [
      ui.success(`${target(organization)} is up to date, nothing to apply`),
    ]
  }
  return [
    planSummary(result.entries),
    `${ui.INDENT}${ui.dim('Run')} ${ui.command('polar config apply')} ${ui.dim('to apply it.')}`,
  ]
}

const render = (
  config: LoadedConfig,
  organization: ActiveOrganization | undefined,
  result: PlanResult,
) => {
  if (organization === undefined || errors(result.issues) > 0) {
    return problems(config, result)
  }
  return [
    ...changes(config, organization, result),
    ui.blank,
    ...outcome(organization, result),
  ]
}

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
              yield* progress.start('Reading')
              const config = yield* billing.load(Option.getOrUndefined(file))
              yield* progress.finish(config.file)
              yield* progress.start('Linting')
              yield* progress.finish(linted(config))
              const organizations = yield* Organizations
              if (errors(config.issues) > 0) {
                return {
                  config,
                  organization: undefined,
                  result: { entries: [], issues: config.issues },
                }
              }
              yield* progress.start('Found')
              yield* progress.finish(found(config))
              yield* progress.start('Comparing')
              const [elapsed, { organization, result }] = yield* Effect.timed(
                Effect.gen(function* () {
                  const organization = yield* organizations.resolve(
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
          const { config, result } = planned
          const posted = yield* commentOnPullRequest(
            `config plan ${config.file}`,
            Effect.gen(function* () {
              const organization =
                planned.organization ??
                (yield* (yield* Organizations).resolve(
                  Option.getOrUndefined(org),
                ))
              return planMarkdown(config, organization, result)
            }),
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
