import { Console, Duration, Effect, Option } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { formatEntries } from '@/commands/config/apply'
import { formatProblems, plural } from '@/commands/config/problems'
import { org } from '@/commands/flags'
import type { ActiveOrganization } from '@/schemas/Auth'
import {
  BillingConfigError,
  type ConfigIssue,
  type LoadedConfig,
} from '@/schemas/BillingConfig'
import { BillingConfig } from '@/services/billing-config'
import { Organizations } from '@/services/organizations'
import { formatDuration, withProgress } from '@/utils/progress'
import * as ui from '@/utils/ui'

const file = Argument.String('file').pipe(
  Argument.withDescription(
    'Path to the billing config file. Defaults to polar.config.ts, polar.config.js or polar.json in the current directory',
  ),
  Argument.optional,
)

const count = (
  issues: ReadonlyArray<ConfigIssue>,
  severity: ConfigIssue['severity'],
) => issues.filter((issue) => issue.severity === severity).length

export const summary = (issues: ReadonlyArray<ConfigIssue>) =>
  `${ui.INDENT}Found ${plural(count(issues, 'error'), 'error')} and ${plural(count(issues, 'warning'), 'warning')}.`

export const finished = (
  duration: Duration.Duration,
  config: LoadedConfig,
  organization: ActiveOrganization,
) =>
  ui.dim(
    `${ui.INDENT}Finished in ${Math.round(Duration.toMillis(duration))}ms on ${config.file}. Planned against ${ui.bold(organization.name)} ${ui.dim(`(${organization.environment})`)}.`,
  )

export const plan = Command.make('plan', { file, org }, ({ file, org }) =>
  Effect.gen(function* () {
    const billing = yield* BillingConfig
    const [duration, { config, organization, result }] = yield* Effect.timed(
      withProgress((progress) =>
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
          yield* progress.start('Planning config')
          const [elapsed, result] = yield* Effect.timed(
            billing.plan(config, organization),
          )
          yield* progress.finish(formatDuration(elapsed))
          return { config, organization, result }
        }),
      ),
    )
    const errors = count(result.issues, 'error')
    yield* Console.log(ui.blank)
    if (result.entries.length > 0) {
      yield* Console.log(formatEntries(result.entries))
      yield* Console.log(ui.blank)
    }
    if (result.issues.length > 0) {
      yield* Console.log(formatProblems(config, result.issues))
      yield* Console.log(ui.blank)
      yield* Console.log(summary(result.issues))
    } else {
      yield* Console.log(ui.success(`${config.file} can be applied`))
    }
    yield* Console.log(finished(duration, config, organization))
    if (errors > 0) {
      return yield* new BillingConfigError({
        message: `${config.file} cannot be applied`,
      })
    }
  }),
).pipe(
  Command.withDescription(
    'Show what applying a billing config file would change, without applying it',
  ),
)
