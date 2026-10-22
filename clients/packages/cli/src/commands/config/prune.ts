import { Clock, Effect, Option, Stdio } from 'effect'
import { Command, Prompt } from 'effect/cli'
import type { ActiveOrganization } from '@/schemas/Auth'
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
import { NOUNS, found, section, target } from '@/utils/billing-config/review'
import { type Say, output } from '@/utils/command'
import { confirm as confirmed, configFile as file, org } from '@/utils/flags'
import { Output } from '@/utils/output'
import { withProgress } from '@/utils/progress'
import * as ui from '@/utils/ui'

const reason = (entry: PruneEntry) =>
  [
    ...(entry.customers === 0
      ? []
      : [
          entry.resource === 'product'
            ? plural(entry.customers, 'subscriber', 'subscribers')
            : plural(entry.customers, 'customer', 'customers'),
        ]),
    ...(entry.referenced_by.length > 0
      ? [`used by ${entry.referenced_by.map(ui.printable).join(', ')}`]
      : []),
  ].join(', ')

const width = (entry: PruneEntry) =>
  Bun.stringWidth(ui.printable(entry.external_id))

const group = (
  section: string,
  entries: ReadonlyArray<PruneEntry>,
  idWidth: number,
) =>
  [
    `${ui.INDENT}${ui.bold(section)}`,
    ...entries
      .filter(removable)
      .map(
        (entry) =>
          `${ui.INDENT}${ui.red('-')} ${ui.bold(ui.printable(entry.external_id))}`,
      ),
    ...entries
      .filter((entry) => !removable(entry))
      .map(
        (entry) =>
          `${ui.INDENT}${ui.dim('=')} ${ui.printable(entry.external_id)}${' '.repeat(idWidth - width(entry))}  ${ui.dim(reason(entry))}`,
      ),
  ].join('\n')

const report = (
  organization: ActiveOrganization,
  entries: ReadonlyArray<PruneEntry>,
) => {
  // Shared across sections so every reason starts in the same column
  const idWidth = Math.max(
    0,
    ...entries.filter((entry) => !removable(entry)).map(width),
  )
  const groups = NOUNS.flatMap(([section, resource]) => {
    const own = entries.filter((entry) => entry.resource === resource)
    return own.length === 0 ? [] : [group(section, own, idWidth)]
  })
  return groups.length === 0
    ? []
    : section(`Deprecated ${ui.dim(target(organization))}`, groups.join('\n\n'))
}

const interactive = Effect.gen(function* () {
  const stdio = yield* Stdio.Stdio
  return (yield* stdio.stdinIsTerminal) && (yield* stdio.stdoutIsTerminal)
})

const confirm =
  (
    config: LoadedConfig,
    organization: ActiveOrganization,
    json: boolean,
    confirmed: boolean,
    say: Say['say'],
  ) =>
  (entries: ReadonlyArray<PruneEntry>) =>
    Effect.gen(function* () {
      yield* say(report(organization, entries))
      if (confirmed) return
      if (json || !(yield* interactive)) {
        return yield* new BillingConfigError({
          message: `Confirmation needed to remove entries from ${config.file}`,
          hint: 'Pass --confirm to remove without asking.',
        })
      }
      yield* say([ui.blank])
      const accepted = yield* Prompt.run(
        Prompt.Confirm({
          message: `Remove ${plural(entries.filter(removable).length, 'entry', 'entries')} from ${config.file}? Nothing on Polar changes.`,
        }),
      ).pipe(Effect.orElseSucceed(() => false))
      if (!accepted) {
        return yield* new BillingConfigError({
          message: `Prune cancelled, ${config.file} unchanged`,
        })
      }
    })

// The report was already shown before confirming when entries were removed
const render = (
  config: LoadedConfig,
  organization: ActiveOrganization,
  entries: ReadonlyArray<PruneEntry>,
  removed: boolean,
) =>
  removed
    ? [
        ui.blank,
        ui.success(
          `${config.file}: ${plural(entries.filter(removable).length, 'entry', 'entries')} removed, nothing changed on Polar`,
        ),
      ]
    : [
        ...report(organization, entries),
        ui.blank,
        ui.success(
          entries.length === 0
            ? `No deprecated entries in ${config.file}`
            : 'Nothing to remove',
        ),
      ]

export const prune = Command.make('prune', { file, org, confirmed }).pipe(
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
      command: 'polar config prune --confirm --json',
      description: 'Remove without asking and print the result as JSON',
    },
  ]),
  output({
    result: PruneOutput,
    run: ({ file, org, confirmed }, { say }) =>
      Effect.gen(function* () {
        const billing = yield* BillingConfig
        const { json } = yield* Output
        return yield* withProgress(
          (progress) =>
            Effect.gen(function* () {
              yield* progress.open('Preflight')
              yield* progress.start('Reading')
              const config = yield* billing.load(Option.getOrUndefined(file))
              yield* progress.finish(config.file)
              yield* progress.start('Found')
              yield* progress.finish(found(config))
              yield* progress.start('Checking')
              const startedAt = yield* Clock.currentTimeMillis
              const checked = Clock.currentTimeMillis.pipe(
                Effect.flatMap((now) =>
                  progress.finish(`${now - startedAt}ms`),
                ),
                Effect.andThen(progress.close),
              )
              const organization = yield* (yield* Organizations).resolve(
                Option.getOrUndefined(org),
              )
              const result = yield* billing.prune(
                config,
                organization,
                (entries) =>
                  checked.pipe(
                    Effect.andThen(
                      confirm(
                        config,
                        organization,
                        json,
                        confirmed,
                        say,
                      )(entries),
                    ),
                  ),
              )
              yield* checked
              return { config, organization, ...result }
            }),
          'columns',
        )
      }),
    render: ({ config, organization, entries, removed }) =>
      render(config, organization, entries, removed),
    json: ({ config, entries, removed }) => ({
      file: config.file,
      entries,
      removed,
    }),
  }),
)
