import { Duration, Effect, Option } from 'effect'
import { Command, Flag, Prompt } from 'effect/cli'
import {
  catalogNameConflict,
  draftConflicts,
} from '@/utils/billing-config/conflicts'
import { changeCount, tally } from '@/utils/billing-config/entries'
import { plural } from '@/utils/billing-config/problems'
import {
  errors,
  fixErrors,
  found,
  next,
  nextOpen,
  overview,
  conflictNext,
  conflictSection,
  sections,
  target,
  unchanged,
} from '@/utils/billing-config/review'
import { type Say, output } from '@/utils/command'
import { confirm, configFile as file, org } from '@/utils/flags'
import { Output } from '@/utils/output'
import type { ActiveOrganization } from '@/schemas/Auth'
import {
  type AppliedEntry,
  type ApplyResult,
  BillingConfigError,
  type LoadedConfig,
  type PlanResult,
  ApplyOutput,
} from '@/schemas/BillingConfig'
import { BillingConfig } from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
import { type Progress, withProgress } from '@/utils/progress'
import { interactive, keypress } from '@/utils/prompt'
import * as ui from '@/utils/ui'

const confirmed = confirm.pipe(Flag.withAlias('aladåb'))

const name = Flag.String('name').pipe(
  Flag.optional,
  Flag.withDescription(
    'Name of the draft catalog version. Defaults to v{n} when published',
  ),
)

const force = Flag.Boolean('force').pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    'Save even when the draft on Polar has changes that are not in the file, discarding them',
  ),
)

const applied = (
  config: LoadedConfig,
  organization: ActiveOrganization,
  entries: ReadonlyArray<AppliedEntry>,
) =>
  unchanged(entries)
    ? ui.success(`${target(organization)} is up to date, nothing to change`)
    : `${ui.INDENT}${config.file} saved to ${target(organization)}: ${plural(entries.length, 'entry', 'entries')} (${tally(entries)})`

const render = (
  config: LoadedConfig,
  organization: ActiveOrganization,
  result: ApplyResult,
  revertedDraft: boolean,
) => {
  if (result.status !== 'applied') return [ui.blank]
  return [
    ...(unchanged(result.entries) ? [ui.blank] : []),
    revertedDraft
      ? ui.success(
          `Changes that are no longer in ${config.file} were removed from the draft of ${target(organization)}`,
        )
      : applied(config, organization, result.entries),
    ...(result.draft
      ? next(
          `${ui.INDENT}Products, benefits, meters and settings are saved to the draft catalog.\n${ui.INDENT}Run ${ui.command('polar config publish')} to make it live.`,
        )
      : []),
    ui.blank,
  ]
}

const approve = (
  config: LoadedConfig,
  organization: ActiveOrganization,
  plan: PlanResult,
  json: boolean,
  confirmed: boolean,
  say: Say['say'],
) =>
  Effect.gen(function* () {
    yield* say(overview(config, organization, plan))
    if (confirmed) return true
    if (json || !(yield* interactive)) {
      yield* say(
        next(
          `${ui.INDENT}Review the changes, then run ${ui.command('polar config draft --confirm')}.`,
        ),
      )
      return yield* new BillingConfigError({
        message: `Confirmation needed to save the draft of ${target(organization)}`,
        hint: 'Pass --confirm to save without asking, after reviewing polar config validate.',
      })
    }
    yield* say(nextOpen())
    return yield* Prompt.run(
      keypress(
        [
          ...ui.boxRows(
            `${ui.INDENT}${ui.green('y')} to save  ${ui.red('n')} to cancel`,
          ),
          ui.boxBottom(),
        ].join('\n'),
      ),
    ).pipe(Effect.catch(() => say([ui.blank]).pipe(Effect.as(false))))
  })

const milliseconds = (elapsed: Duration.Duration) =>
  `${Math.round(Duration.toMillis(elapsed))}ms`

const compare = (
  config: LoadedConfig,
  org: string | undefined,
  name: string | undefined,
) =>
  Effect.gen(function* () {
    const billing = yield* BillingConfig
    const organization = yield* (yield* Organizations).resolve(org)
    const againstLive = yield* billing.plan(config, organization, { name })
    const compared = (
      plan: PlanResult,
      conflicts: ReadonlyArray<AppliedEntry> = [],
    ) => ({ organization, plan, conflicts })
    if (errors(againstLive.issues) > 0) return compared(againstLive)
    const { draft } = yield* billing.catalogs(organization)
    if (draft === null) return compared(againstLive)
    const againstDraft = yield* billing.plan(config, organization, {
      name,
      catalogId: draft.id,
    })
    if (errors(againstDraft.issues) > 0) return compared(againstDraft)
    return compared(
      unchanged(againstLive.entries) ? againstDraft : againstLive,
      [
        ...draftConflicts(againstLive.entries, againstDraft.entries),
        ...catalogNameConflict(againstLive.catalog, draft),
      ],
    )
  })

const preflight = (
  progress: Progress,
  file: string | undefined,
  org: string | undefined,
  name: string | undefined,
) =>
  Effect.gen(function* () {
    yield* progress.open('Preflight')
    yield* progress.start('Reading')
    const config = yield* (yield* BillingConfig).load(file)
    yield* progress.finish(config.file)
    yield* progress.start('Found')
    yield* progress.finish(found(config))
    yield* progress.start('Comparing')
    const [elapsed, compared] = yield* Effect.timed(compare(config, org, name))
    yield* progress.finish(milliseconds(elapsed))
    yield* progress.close
    return { config, ...compared }
  })

const save = (
  progress: Progress,
  config: LoadedConfig,
  organization: ActiveOrganization,
  plan: PlanResult,
  name: string | undefined,
) =>
  Effect.gen(function* () {
    yield* progress.open('Draft')
    yield* progress.start(
      `Saving ${plural(changeCount(plan.entries), 'change')}`,
    )
    const [elapsed, result] = yield* Effect.timed(
      (yield* BillingConfig).apply(config, organization, { name }),
    )
    yield* progress.finish(`(${milliseconds(elapsed)})`)
    return result
  })

const execute = (
  progress: Progress,
  file: string | undefined,
  org: string | undefined,
  name: string | undefined,
  confirmed: boolean,
  force: boolean,
  say: Say['say'],
) =>
  Effect.gen(function* () {
    const { json } = yield* Output
    const { config, organization, plan, conflicts } = yield* preflight(
      progress,
      file,
      org,
      name,
    )
    const outcome = (result: ApplyResult, revertedDraft = false) => ({
      config,
      organization,
      result,
      revertedDraft,
    })
    if (errors(plan.issues) > 0) {
      yield* say([
        ...sections(config, plan),
        ...overview(config, organization, plan),
        ...next(fixErrors(plan.issues)),
      ])
      return outcome({ status: 'rejected', issues: plan.issues })
    }
    if (conflicts.length > 0) {
      yield* say(
        conflictSection(
          config,
          conflicts,
          force ? 'Discarding from the draft' : undefined,
        ),
      )
      if (!force) {
        yield* say(conflictNext(config.file))
        return outcome({ status: 'conflict', conflicts })
      }
    }
    if (unchanged(plan.entries)) {
      if (plan.issues.length > 0) yield* say(sections(config, plan))
      return outcome({
        status: 'applied',
        entries: plan.entries,
        issues: plan.issues,
      })
    }
    yield* say(sections(config, plan))
    if (!(yield* approve(config, organization, plan, json, confirmed, say))) {
      return yield* new BillingConfigError({
        message: 'Draft cancelled, nothing changed',
      })
    }
    const result = yield* save(progress, config, organization, plan, name)
    return result.status === 'applied'
      ? outcome({ ...result, issues: plan.issues }, unchanged(result.entries))
      : outcome(result)
  })

export const draft = Command.make('draft', {
  file,
  org,
  confirmed,
  name,
  force,
}).pipe(
  Command.withDescription(
    'Save a billing config file to the draft catalog of your organization. Nothing changes for customers until you publish it',
  ),
  Command.withExamples([
    {
      command: 'polar config draft',
      description:
        'Show what polar.config.ts would change, then save it to the draft after confirmation',
    },
    {
      command: 'polar config draft billing/polar.json',
      description: 'Save a specific file',
    },
    {
      command: 'polar config draft --org acme',
      description: 'Save to another organization, by slug or ID',
    },
    {
      command: 'polar config draft --confirm',
      description: 'Save without asking, for scripts and CI',
    },
    {
      command: "polar config draft --name 'Spring launch'",
      description: 'Name the draft catalog version',
    },
    {
      command: 'polar config draft --force',
      description:
        'Save the file even when the draft has changes that are not in it',
    },
    {
      command: 'polar config draft --confirm --json',
      description: 'Print what was saved as JSON, for scripts and agents',
    },
  ]),
  output({
    result: ApplyOutput,
    run: ({ file, org, confirmed, name, force }, { say }) =>
      withProgress(
        (progress) =>
          execute(
            progress,
            Option.getOrUndefined(file),
            Option.getOrUndefined(org),
            Option.getOrUndefined(name),
            confirmed,
            force,
            say,
          ),
        'columns',
      ),
    render: ({ config, organization, result, revertedDraft }) =>
      render(config, organization, result, revertedDraft),
    json: ({ config, result }) => ({ file: config.file, ...result }),
    failed: ({ config, organization, result }) => {
      if (result.status === 'rejected') {
        return new BillingConfigError({
          message: `${config.file} was not saved`,
        })
      }
      if (result.status === 'conflict') {
        return new BillingConfigError({
          message: `The draft of ${target(organization)} has changes that are not in ${config.file}`,
          hint: 'Run polar config reset to replace the file with the draft, or polar config draft --force to replace the draft with the file.',
        })
      }
      return undefined
    },
  }),
)
