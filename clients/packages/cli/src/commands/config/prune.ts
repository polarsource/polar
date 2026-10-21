import { Clock, Effect, Option, Stdio } from 'effect'
import { Command, Flag, Prompt } from 'effect/cli'
import {
  BillingConfigError,
  type LoadedConfig,
  type PruneEntry,
  PruneOutput,
} from '@/schemas/BillingConfig'
import { BillingConfig } from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
import { plural } from '@/utils/billing-config/problems'
import { removable } from '@/utils/billing-config/prune'
import { found } from '@/utils/billing-config/review'
import { type Say, output } from '@/utils/command'
import { configFile as file, org } from '@/utils/flags'
import { Output } from '@/utils/output'
import { withProgress } from '@/utils/progress'
import * as ui from '@/utils/ui'

const yes = Flag.Boolean('yes').pipe(
  Flag.withAlias('y'),
  Flag.withDefault(false),
  Flag.withDescription('Remove without asking for confirmation'),
)

const reason = (entry: PruneEntry) =>
  [
    ...(entry.in_use ? ['has customers'] : []),
    ...(entry.referenced_by.length > 0
      ? [`used by ${entry.referenced_by.join(', ')}`]
      : []),
  ].join(', ')

const section = (
  title: string,
  entries: ReadonlyArray<PruneEntry>,
  value: (entry: PruneEntry) => string,
) =>
  entries.length === 0
    ? []
    : [
        ui.blank,
        `${ui.INDENT}${ui.dim(title)}`,
        ui.keyValue(entries.map((entry) => [entry.resource, value(entry)])),
      ]

const report = (entries: ReadonlyArray<PruneEntry>) => [
  ...section('REMOVABLE', entries.filter(removable), (entry) =>
    ui.printable(entry.external_id),
  ),
  ...section(
    'STILL IN USE',
    entries.filter((entry) => !removable(entry)),
    (entry) => `${ui.printable(entry.external_id)}  ${ui.dim(reason(entry))}`,
  ),
]

const interactive = Effect.gen(function* () {
  const stdio = yield* Stdio.Stdio
  return (yield* stdio.stdinIsTerminal) && (yield* stdio.stdoutIsTerminal)
})

const confirm =
  (config: LoadedConfig, json: boolean, yes: boolean, say: Say['say']) =>
  (entries: ReadonlyArray<PruneEntry>) =>
    Effect.gen(function* () {
      yield* say(report(entries))
      if (yes) return
      if (json || !(yield* interactive)) {
        return yield* new BillingConfigError({
          message: `Confirmation needed to remove entries from ${config.file}`,
          hint: 'Pass --yes to remove without asking.',
        })
      }
      yield* say([ui.blank])
      const confirmed = yield* Prompt.run(
        Prompt.Confirm({
          message: `Remove ${plural(entries.filter(removable).length, 'entry', 'entries')} from ${config.file}?`,
        }),
      ).pipe(Effect.orElseSucceed(() => false))
      if (!confirmed) {
        return yield* new BillingConfigError({
          message: `Prune cancelled, ${config.file} unchanged`,
        })
      }
    })

// The report was already shown before confirming when entries were removed
const render = (
  config: LoadedConfig,
  entries: ReadonlyArray<PruneEntry>,
  removed: boolean,
) =>
  removed
    ? [
        ui.blank,
        ui.success(
          `${config.file}: ${plural(entries.filter(removable).length, 'entry', 'entries')} removed`,
        ),
      ]
    : [
        ...report(entries),
        ui.blank,
        ui.success(
          entries.length === 0
            ? `No deprecated entries in ${config.file}`
            : 'Nothing to remove',
        ),
      ]

export const prune = Command.make('prune', { file, org, yes }).pipe(
  Command.withDescription(
    'Remove unused deprecated entries from a billing config file, without changing anything on Polar',
  ),
  Command.withExamples([
    {
      command: 'polar config prune',
      description:
        'List the deprecated entries in polar.config.ts and remove the unused ones after confirmation',
    },
    {
      command: 'polar config prune billing/polar.json',
      description: 'Prune a specific file',
    },
    {
      command: 'polar config prune --org acme',
      description: 'Check usage in another organization, by slug or ID',
    },
    {
      command: 'polar config prune --yes --json',
      description: 'Remove without asking and print the result as JSON',
    },
  ]),
  output({
    result: PruneOutput,
    run: ({ file, org, yes }, { say }) =>
      Effect.gen(function* () {
        const billing = yield* BillingConfig
        const { json } = yield* Output
        return yield* withProgress(
          (progress) =>
            Effect.gen(function* () {
              yield* progress.start('Reading')
              const config = yield* billing.load(Option.getOrUndefined(file))
              yield* progress.finish(config.file)
              yield* progress.start('Found')
              yield* progress.finish(found(config))
              yield* progress.start('Checking usage')
              const startedAt = yield* Clock.currentTimeMillis
              const checked = Clock.currentTimeMillis.pipe(
                Effect.flatMap((now) =>
                  progress.finish(`${now - startedAt}ms`),
                ),
              )
              const organization = yield* (yield* Organizations).resolve(
                Option.getOrUndefined(org),
              )
              const result = yield* billing.prune(
                config,
                organization,
                (entries) =>
                  checked.pipe(
                    Effect.andThen(confirm(config, json, yes, say)(entries)),
                  ),
              )
              yield* checked
              return { config, ...result }
            }),
          'columns',
        )
      }),
    render: ({ config, entries, removed }) => render(config, entries, removed),
    json: ({ config, entries, removed }) => ({
      file: config.file,
      entries,
      removed,
    }),
  }),
)
