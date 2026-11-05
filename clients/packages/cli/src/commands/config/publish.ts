import { Effect, Option, Stdio } from 'effect'
import { Command, Prompt } from 'effect/cli'
import type { ActiveOrganization } from '@/schemas/Auth'
import {
  type AppliedEntry,
  BillingConfigError,
  type Catalog,
  type Catalogs,
  type LoadedConfig,
  NO_CONFIG_FILE,
  PublishOutput,
} from '@/schemas/BillingConfig'
import { BillingConfig } from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
import {
  errors,
  next,
  nextOpen,
  section,
  target,
} from '@/utils/billing-config/review'
import { type Say, output } from '@/utils/command'
import { plural } from '@/utils/billing-config/problems'
import { formatTree } from '@/utils/billing-config/tree'
import { confirm as confirmed, configFile as file, org } from '@/utils/flags'
import { Output } from '@/utils/output'
import { withProgress } from '@/utils/progress'
import * as ui from '@/utils/ui'

const label = (catalog: Catalog | null, fallback: string) =>
  catalog === null ? ui.dim('none') : (catalog.name ?? ui.dim(fallback))

const summary = (organization: ActiveOrganization, { live, draft }: Catalogs) =>
  section(
    'Summary',
    ui.keyValue([
      ['Organization', organization.name],
      ['Environment', organization.environment],
      [
        'Catalog',
        `${label(live, 'unnamed')} ${ui.dim('→')} ${label(draft, 'draft')}`,
      ],
    ]),
  )

interface Drift {
  readonly config: LoadedConfig
  readonly entries: ReadonlyArray<AppliedEntry>
}

// Meters, settings and webhooks apply right away, only products and benefits wait in the draft
const drifted = (entries: ReadonlyArray<AppliedEntry>) =>
  entries.filter(
    (entry) =>
      (entry.section === 'products' || entry.section === 'benefits') &&
      entry.action !== 'unchanged',
  )

const report = (drift: Drift | null) =>
  drift === null || drift.entries.length === 0
    ? []
    : section(
        `Not in the draft ${ui.dim(drift.config.file)}`,
        formatTree(drift.config.input, drift.entries),
      )

const warning = ui.bold(ui.yellow('Warning:'))

const interactive = Effect.gen(function* () {
  const stdio = yield* Stdio.Stdio
  return (yield* stdio.stdinIsTerminal) && (yield* stdio.stdoutIsTerminal)
})

const keypress = (frame: string) =>
  Prompt.Custom<boolean, boolean>(false, {
    render: (_, action) =>
      Effect.succeed(
        action._tag === 'NextFrame'
          ? frame
          : action._tag === 'Submit'
            ? `${frame}\n`
            : '',
      ),
    process: (input) =>
      Effect.succeed(
        input.key.name === 'y'
          ? { _tag: 'Submit', value: true }
          : input.key.name === 'n' || input.key.name === 'escape'
            ? { _tag: 'Submit', value: false }
            : { _tag: 'Beep' },
      ),
    clear: () => Effect.succeed(ui.clearLines(frame.split('\n').length)),
  })

const approve = (
  organization: ActiveOrganization,
  drift: Drift | null,
  json: boolean,
  confirmed: boolean,
  say: Say['say'],
) =>
  Effect.gen(function* () {
    if (confirmed) return
    if (json || !(yield* interactive)) {
      return yield* new BillingConfigError({
        message: `Confirmation needed to publish to ${target(organization)}`,
        hint: 'Pass --confirm to publish without asking.',
      })
    }
    yield* say(nextOpen())
    const accepted = yield* Prompt.run(
      keypress(
        [
          ...[
            ...(drift && drift.entries.length > 0
              ? [
                  `${ui.INDENT}${warning} ${drift.config.file} has changes that are not in the draft.`,
                  `${ui.INDENT}Run ${ui.command('polar config apply')} first to include them.`,
                  '',
                  `${ui.INDENT}Publishing makes the draft live for new checkouts.`,
                ]
              : [
                  `${ui.INDENT}${warning} Publishing makes the draft live for new checkouts.`,
                ]),
            '',
            `${ui.INDENT}${ui.green('y')} to publish  ${ui.red('n')} to cancel`,
          ].flatMap((line) => ui.boxRows(line)),
          ui.boxBottom(),
        ].join('\n'),
      ),
    ).pipe(Effect.catch(() => say([ui.blank]).pipe(Effect.as(false))))
    if (!accepted) {
      return yield* new BillingConfigError({
        message: 'Publish cancelled, nothing changed',
      })
    }
  })

const render = (
  organization: ActiveOrganization,
  { live }: Catalogs,
  published: boolean,
) =>
  published && live
    ? [
        ui.blank,
        ui.success(
          `${live.name ?? 'The draft'} is live for ${target(organization)}. Existing customers stay on their current versions.`,
        ),
        ui.blank,
      ]
    : [
        ui.blank,
        ui.success(`No draft to publish for ${target(organization)}`),
        ...next(
          `${ui.INDENT}Run ${ui.command('polar config apply')} to save product and benefit changes to a draft.`,
        ),
        ui.blank,
      ]

export const publish = Command.make('publish', { file, org, confirmed }).pipe(
  Command.withDescription(
    "Make your organization's draft catalog live, so new checkouts sell its products and benefits",
  ),
  Command.withExamples([
    {
      command: 'polar config publish',
      description:
        'Publish the draft after confirmation, warning about changes in polar.config.ts that the draft is missing',
    },
    {
      command: 'polar config publish --org acme',
      description: 'Publish the draft of another organization, by slug or ID',
    },
    {
      command: 'polar config apply --confirm && polar config publish --confirm',
      description: 'Save and publish in one go, for scripts and CI',
    },
  ]),
  output({
    result: PublishOutput,
    run: ({ file, org, confirmed }, { say }: Say) =>
      Effect.gen(function* () {
        const billing = yield* BillingConfig
        const { json } = yield* Output
        const { organization, catalogs, drift } = yield* withProgress(
          (progress) =>
            Effect.gen(function* () {
              yield* progress.open('Preflight')
              yield* progress.start('Checking')
              const organization = yield* (yield* Organizations).resolve(
                Option.getOrUndefined(org),
              )
              const catalogs = yield* billing.catalogs(organization)
              yield* progress.finish(
                catalogs.draft ? 'draft found' : 'no draft',
              )
              if (catalogs.draft === null) {
                yield* progress.close
                return { organization, catalogs, drift: null }
              }
              yield* progress.start('Comparing')
              const draft = catalogs.draft
              const drift = yield* billing
                .load(Option.getOrUndefined(file))
                .pipe(
                  Effect.flatMap((config) =>
                    billing
                      .plan(config, organization, { catalogId: draft.id })
                      .pipe(
                        Effect.flatMap((plan) =>
                          errors(plan.issues) > 0
                            ? new BillingConfigError({
                                message: `Could not compare ${config.file} with the draft, it has ${plural(errors(plan.issues), 'error')}`,
                                hint: `Run polar config plan to see them, then fix ${config.file}.`,
                              })
                            : Effect.succeed<Drift>({
                                config,
                                entries: drifted(plan.entries),
                              }),
                        ),
                      ),
                  ),
                  Effect.tap(({ config, entries }) =>
                    progress.finish(
                      entries.length === 0
                        ? `${config.file} matches the draft`
                        : `${config.file} has ${plural(entries.length, 'change')} not in the draft`,
                    ),
                  ),
                  Effect.catchIf(
                    (error) =>
                      error._tag === 'BillingConfigError' &&
                      error.message === NO_CONFIG_FILE &&
                      Option.isNone(file),
                    () =>
                      progress
                        .finish('skipped, no config file found')
                        .pipe(Effect.as(null)),
                  ),
                )
              yield* progress.close
              return { organization, catalogs, drift }
            }),
          'columns',
        )
        if (catalogs.draft === null) {
          return { organization, catalogs, published: false, drift }
        }
        yield* say([...summary(organization, catalogs), ...report(drift)])
        yield* approve(organization, drift, json, confirmed, say)
        const live = yield* billing.publish(organization, catalogs.draft)
        return {
          organization,
          catalogs: { live, draft: null },
          published: true,
          drift,
        }
      }),
    render: ({ organization, catalogs, published }) =>
      render(organization, catalogs, published),
    json: ({ catalogs, published, drift }) => ({
      ...catalogs,
      published,
      drift: drift?.entries ?? null,
    }),
  }),
)
