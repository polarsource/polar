import { Duration, Effect, Option } from 'effect'
import { Argument, Command } from 'effect/cli'
import { DONE, formatEntries, tally } from '@/utils/billing-config/entries'
import { formatProblems, plural } from '@/utils/billing-config/problems'
import { output } from '@/utils/command'
import { org } from '@/utils/flags'
import {
  type AppliedEntry,
  type ApplyResult,
  BillingConfigError,
  type LoadedConfig,
  ApplyOutput,
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

const render = (config: LoadedConfig, result: ApplyResult) =>
  result.status === 'rejected'
    ? [
        ui.blank,
        formatProblems(config, result.issues),
        ui.blank,
        `${ui.INDENT}Found ${plural(result.issues.length, 'error')}.`,
      ]
    : [
        ui.blank,
        ...(result.entries.length > 0
          ? [formatEntries(result.entries, DONE), ui.blank]
          : []),
        applied(config, result.entries),
      ]

export const apply = Command.make('apply', { file, org }).pipe(
  Command.withDescription(
    'Create or update everything in a billing config file for your organization',
  ),
  output({
    result: ApplyOutput,
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
            yield* progress.start('Applying config')
            const [elapsed, result] = yield* Effect.timed(
              billing.apply(config, organization),
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
      result.status === 'rejected'
        ? new BillingConfigError({ message: `${config.file} was not applied` })
        : undefined,
  }),
)
