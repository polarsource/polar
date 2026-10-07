import { Console, Duration, Effect, Option } from 'effect'
import { Argument, Command } from 'effect/cli'
import { formatProblems, plural } from '@/commands/config/problems'
import { org } from '@/commands/flags'
import type { ActiveOrganization } from '@/schemas/Auth'
import {
  type AppliedEntry,
  BillingConfigError,
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

const MARKS: Record<AppliedEntry['action'], string> = {
  created: ui.green('+'),
  updated: ui.yellow('~'),
  unchanged: ui.dim('='),
}

const bySection = (entries: ReadonlyArray<AppliedEntry>) =>
  [...new Set(entries.map((entry) => entry.section))].map((section) => ({
    section,
    entries: entries.filter((entry) => entry.section === section),
  }))

export const formatEntries = (entries: ReadonlyArray<AppliedEntry>) => {
  const width = Math.max(...entries.map((entry) => entry.id.length))
  return bySection(entries)
    .map(({ section, entries }) =>
      [
        `${ui.INDENT}${ui.bold(section)}`,
        ...entries.map(
          (entry) =>
            `${ui.INDENT}${ui.INDENT}${MARKS[entry.action]} ${entry.id.padEnd(width)}  ${ui.dim(entry.action)}`,
        ),
      ].join('\n'),
    )
    .join('\n\n')
}

const tally = (entries: ReadonlyArray<AppliedEntry>) =>
  (['created', 'updated', 'unchanged'] as const)
    .map(
      (action) =>
        `${entries.filter((entry) => entry.action === action).length} ${action}`,
    )
    .join(', ')

export const applied = (
  config: LoadedConfig,
  entries: ReadonlyArray<AppliedEntry>,
) =>
  ui.success(
    `${config.file} applied: ${plural(entries.length, 'entry', 'entries')} (${tally(entries)})`,
  )

export const finished = (
  duration: Duration.Duration,
  config: LoadedConfig,
  organization: ActiveOrganization,
  outcome: 'applied' | 'rejected',
) =>
  ui.dim(
    `${ui.INDENT}Finished in ${Math.round(Duration.toMillis(duration))}ms on ${config.file}. ${outcome === 'applied' ? 'Applied to' : 'Nothing applied to'} ${ui.bold(organization.name)} ${ui.dim(`(${organization.environment})`)}.`,
  )

export const apply = Command.make('apply', { file, org }, ({ file, org }) =>
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
          yield* progress.start('Applying config')
          const [elapsed, result] = yield* Effect.timed(
            billing.apply(config, organization),
          )
          yield* progress.finish(formatDuration(elapsed))
          return { config, organization, result }
        }),
      ),
    )
    yield* Console.log(ui.blank)
    if (result.status === 'rejected') {
      yield* Console.log(formatProblems(config, result.issues))
      yield* Console.log(ui.blank)
      yield* Console.log(
        `${ui.INDENT}Found ${plural(result.issues.length, 'error')}.`,
      )
      yield* Console.log(finished(duration, config, organization, 'rejected'))
      return yield* new BillingConfigError({
        message: `${config.file} was not applied`,
      })
    }
    if (result.entries.length > 0) {
      yield* Console.log(formatEntries(result.entries))
      yield* Console.log(ui.blank)
    }
    yield* Console.log(applied(config, result.entries))
    yield* Console.log(finished(duration, config, organization, 'applied'))
  }),
).pipe(
  Command.withDescription(
    'Create or update everything in a billing config file for your organization',
  ),
)
