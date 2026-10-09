import { Duration, Effect, Option } from 'effect'
import { Command } from 'effect/cli'
import {
  BillingConfigError,
  type ConfigIssue,
  type LoadedConfig,
  type PlanResult,
  PlanOutput,
} from '@/schemas/BillingConfig'
import { BillingConfig } from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
import { TO_DO, tally } from '@/utils/billing-config/entries'
import { formatTree } from '@/utils/billing-config/tree'
import { formatProblems, plural } from '@/utils/billing-config/problems'
import { output } from '@/utils/command'
import { configFile as file, org } from '@/utils/flags'
import { withProgress } from '@/utils/progress'
import * as ui from '@/utils/ui'

const count = (
  issues: ReadonlyArray<ConfigIssue>,
  severity: ConfigIssue['severity'],
) => issues.filter((issue) => issue.severity === severity).length

export const summary = (issues: ReadonlyArray<ConfigIssue>) =>
  `${ui.INDENT}Found ${plural(count(issues, 'error'), 'error')} and ${plural(count(issues, 'warning'), 'warning')}.`

const render = (config: LoadedConfig, result: PlanResult) => [
  ui.blank,
  ...(result.entries.length > 0
    ? [formatTree(config.input, result.entries), ui.blank]
    : []),
  ...(result.issues.length > 0
    ? [formatProblems(config, result.issues), ui.blank, summary(result.issues)]
    : result.entries.every((entry) => entry.action === 'unchanged')
      ? [ui.success(`${config.file} is up to date, nothing to apply`)]
      : [
          ui.success(
            `${config.file} can be applied: ${tally(result.entries, TO_DO)}`,
          ),
          `${ui.INDENT}${ui.INDENT}${ui.dim('Run')} ${ui.command('polar config apply')} ${ui.dim('to make these changes.')}`,
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
        return yield* withProgress((progress) =>
          Effect.gen(function* () {
            yield* progress.start('Reading config')
            const config = yield* billing.load(Option.getOrUndefined(file))
            yield* progress.finish(config.file)
            yield* progress.start('Resolving organization')
            const organization = yield* (yield* Organizations).resolve(
              Option.getOrUndefined(org),
            )
            yield* progress.finish(
              `${organization.name} (${organization.environment})`,
            )
            yield* progress.start('Checking config')
            const [elapsed, result] = yield* Effect.timed(
              billing.plan(config, organization),
            )
            yield* progress.finish(
              `${Math.round(Duration.toMillis(elapsed))}ms`,
            )
            return { config, result }
          }),
        )
      }),
    render: ({ config, result }) => render(config, result),
    json: ({ config, result }) => ({ file: config.file, ...result }),
    failed: ({ config, result }) =>
      count(result.issues, 'error') > 0
        ? new BillingConfigError({
            message: `${config.file} cannot be applied`,
          })
        : undefined,
  }),
)
