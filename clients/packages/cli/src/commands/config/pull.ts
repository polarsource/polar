import { Duration, Effect, Option } from 'effect'
import { Argument, Command, Flag } from 'effect/cli'
import {
  BillingConfigError,
  type PullResult,
  PullResult as PullResultSchema,
  type SkippedResource,
} from '@/schemas/BillingConfig'
import { BillingConfig } from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
import { plural } from '@/utils/billing-config/problems'
import { output } from '@/utils/command'
import { org } from '@/utils/flags'
import { withProgress } from '@/utils/progress'
import * as ui from '@/utils/ui'

const file = Argument.String('file').pipe(
  Argument.withDescription(
    'Where to write the config. Defaults to the config file in the current directory, or polar.config.ts; a .json path writes JSON instead of TypeScript',
  ),
  Argument.optional,
)

const force = Flag.Boolean('force').pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    'Overwrite the file even if it differs from the organization',
  ),
)

const REASONS: Record<string, string> = {
  missing_external_id: 'has no external ID',
  invalid: 'cannot be expressed as config',
  over_limit: 'is over the config limit',
}

const actionable = (skipped: ReadonlyArray<SkippedResource>) =>
  skipped.filter(({ reason }) => reason !== 'archived')

const formatSkipped = (skipped: ReadonlyArray<SkippedResource>) => [
  ui.warning(
    `Not in the config: ${plural(skipped.length, 'resource')} the config cannot manage yet`,
  ),
  ...skipped.map(
    ({ resource, name, id, reason }) =>
      `${ui.INDENT}${ui.INDENT}${ui.printable(name)} ${ui.dim(`(${resource} ${id}) ${REASONS[reason] ?? reason}`)}`,
  ),
  ...(skipped.some(({ reason }) => reason === 'missing_external_id')
    ? [
        ui.step(
          'Set an external ID in the dashboard to manage a resource from the config.',
        ),
      ]
    : []),
]

const formatEntries = (
  entries: PullResult['entries'],
  mark: (id: string) => string,
) =>
  [...new Set(entries.map((entry) => entry.section))].flatMap((section) => [
    `${ui.INDENT}${ui.bold(section)}`,
    ...entries
      .filter((entry) => entry.section === section)
      .map(
        (entry) => `${ui.INDENT}${ui.INDENT}${mark(ui.printable(entry.id))}`,
      ),
  ])

const render = (result: PullResult) =>
  result.status === 'conflict'
    ? [
        ui.blank,
        ...formatEntries(result.entries, (id) => `${ui.yellow('~')} ${id}`),
      ]
    : [
        ui.blank,
        ...(result.entries.length > 0
          ? [
              ...formatEntries(
                result.entries,
                (id) => `${ui.green('+')} ${id}`,
              ),
              ui.blank,
            ]
          : []),
        ...(actionable(result.skipped).length > 0
          ? [...formatSkipped(actionable(result.skipped)), ui.blank]
          : []),
        ui.success(
          `${result.file} written: ${plural(result.entries.length, 'entry', 'entries')}`,
        ),
      ]

export const pull = Command.make('pull', { file, org, force }).pipe(
  Command.withDescription(
    'Write the current billing config of your organization to a file',
  ),
  Command.withExamples([
    {
      command: 'polar config pull',
      description: 'Write polar.config.ts in the current directory',
    },
    {
      command: 'polar config pull billing/polar.json',
      description: 'Write the config as JSON to a specific file',
    },
    {
      command: 'polar config pull --org acme',
      description: 'Pull from another organization, by slug or ID',
    },
    {
      command: 'polar config pull --force',
      description: 'Overwrite a file that differs from the organization',
    },
  ]),
  output({
    result: PullResultSchema,
    run: ({ file, org, force }) =>
      Effect.gen(function* () {
        const billing = yield* BillingConfig
        return yield* withProgress((progress) =>
          Effect.gen(function* () {
            yield* progress.start('Resolving organization')
            const organization = yield* (yield* Organizations).resolve(
              Option.getOrUndefined(org),
            )
            yield* progress.finish(
              `${organization.name} (${organization.environment})`,
            )
            yield* progress.start('Exporting config')
            const [elapsed, result] = yield* Effect.timed(
              billing.pull(organization, Option.getOrUndefined(file), force),
            )
            yield* progress.finish(
              `${Math.round(Duration.toMillis(elapsed))}ms`,
            )
            return result
          }),
        )
      }),
    render,
    failed: (result) =>
      result.status === 'conflict'
        ? new BillingConfigError({
            message: `${result.file} differs from the organization for ${plural(result.entries.length, 'entry', 'entries')}`,
            hint: 'Compare them in your editor. Keep the file with polar config apply, or overwrite it with polar config pull --force.',
          })
        : undefined,
  }),
)
