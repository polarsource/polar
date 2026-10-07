import { Console, Duration, Effect, Option } from 'effect'
import { Argument, Command } from 'effect/cli'
import { PLANNED, formatEntries } from '@/utils/billing-config/entries'
import { formatProblems, plural } from '@/utils/billing-config/problems'
import { org } from '@/utils/flags'
import { BillingConfigError, type ConfigIssue } from '@/schemas/BillingConfig'
import { BillingConfig } from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
import { withProgress } from '@/utils/progress'
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

export const plan = Command.make('plan', { file, org }, ({ file, org }) =>
  Effect.gen(function* () {
    const billing = yield* BillingConfig
    const { config, result } = yield* withProgress((progress) =>
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
        yield* progress.finish(`${Math.round(Duration.toMillis(elapsed))}ms`)
        return { config, organization, result }
      }),
    )
    const errors = count(result.issues, 'error')
    yield* Console.log(ui.blank)
    if (result.entries.length > 0) {
      yield* Console.log(formatEntries(result.entries, PLANNED))
      yield* Console.log(ui.blank)
    }
    if (result.issues.length > 0) {
      yield* Console.log(formatProblems(config, result.issues))
      yield* Console.log(ui.blank)
      yield* Console.log(summary(result.issues))
    } else {
      yield* Console.log(ui.success(`${config.file} can be applied`))
    }
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
