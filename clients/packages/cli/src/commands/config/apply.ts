import { Duration, Effect, Option } from 'effect'
import { Command } from 'effect/cli'
import { tally } from '@/utils/billing-config/entries'
import { formatTree } from '@/utils/billing-config/tree'
import { formatProblems, plural } from '@/utils/billing-config/problems'
import { output } from '@/utils/command'
import { configFile as file, org } from '@/utils/flags'
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

export const applied = (
  config: LoadedConfig,
  entries: ReadonlyArray<AppliedEntry>,
) =>
  entries.every((entry) => entry.action === 'unchanged')
    ? ui.success(`${config.file} is up to date, nothing to apply`)
    : ui.success(
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
          ? [formatTree(config.input, result.entries), ui.blank]
          : []),
        applied(config, result.entries),
      ]

export const apply = Command.make('apply', { file, org }).pipe(
  Command.withDescription(
    'Create or update everything in a billing config file for your organization',
  ),
  Command.withExamples([
    {
      command: 'polar config apply',
      description: 'Apply polar.config.ts in the current directory',
    },
    {
      command: 'polar config apply billing/polar.json',
      description: 'Apply a specific file',
    },
    {
      command: 'polar config apply --org acme',
      description: 'Apply to another organization, by slug or ID',
    },
    {
      command: 'polar config apply --json',
      description: 'Print what was applied as JSON, for scripts and agents',
    },
  ]),
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
