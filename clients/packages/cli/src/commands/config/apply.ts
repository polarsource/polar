import { Console, Duration, Effect, Option } from 'effect'
import { Argument, Command } from 'effect/cli'
import { DONE, formatEntries, tally } from '@/utils/billing-config/entries'
import { formatProblems, plural } from '@/utils/billing-config/problems'
import { org } from '@/utils/flags'
import {
  type AppliedEntry,
  BillingConfigError,
  type LoadedConfig,
} from '@/schemas/BillingConfig'
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

export const applied = (
  config: LoadedConfig,
  entries: ReadonlyArray<AppliedEntry>,
) =>
  ui.success(
    `${config.file} applied: ${plural(entries.length, 'entry', 'entries')} (${tally(entries)})`,
  )

export const apply = Command.make('apply', { file, org }, ({ file, org }) =>
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
        yield* progress.start('Applying config')
        const [elapsed, result] = yield* Effect.timed(
          billing.apply(config, organization),
        )
        yield* progress.finish(`${Math.round(Duration.toMillis(elapsed))}ms`)
        return { config, organization, result }
      }),
    )
    yield* Console.log(ui.blank)
    if (result.status === 'rejected') {
      yield* Console.log(formatProblems(config, result.issues))
      yield* Console.log(ui.blank)
      yield* Console.log(
        `${ui.INDENT}Found ${plural(result.issues.length, 'error')}.`,
      )
      return yield* new BillingConfigError({
        message: `${config.file} was not applied`,
      })
    }
    if (result.entries.length > 0) {
      yield* Console.log(formatEntries(result.entries, DONE))
      yield* Console.log(ui.blank)
    }
    yield* Console.log(applied(config, result.entries))
  }),
).pipe(
  Command.withDescription(
    'Create or update everything in a billing config file for your organization',
  ),
)
