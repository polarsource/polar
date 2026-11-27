import { Duration, Effect, Option } from 'effect'
import { Command } from 'effect/cli'
import type { ActiveOrganization } from '@/schemas/Auth'
import {
  type AppliedEntry,
  BillingConfigError,
  type Catalog,
  type LoadedConfig,
  type PlanCatalogs,
  type PlanDraft,
  type PlanResult,
  PlanOutput,
} from '@/schemas/BillingConfig'
import { BillingConfig } from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
import { commentOnPullRequest } from '@/services/pull-request-comment'
import { record } from '@/utils/billing-config/describe'
import {
  catalogNameConflict,
  draftConflicts,
} from '@/utils/billing-config/conflicts'
import { planMarkdown } from '@/utils/billing-config/markdown'
import {
  draftedChanges,
  draftNext,
  errors,
  fixErrors,
  found,
  next,
  overview,
  runDraft,
  conflictSection,
  sections,
  target,
  unchanged,
} from '@/utils/billing-config/review'
import { output } from '@/utils/command'
import { configFile as file, org } from '@/utils/flags'
import { withProgress } from '@/utils/progress'
import { commented, prComment } from '@/utils/pull-request-comment'
import { validateUsage } from '@/utils/billing-config/usage'
import * as ui from '@/utils/ui'

// A plan against the draft never reports the catalog, so a name the file sets is compared here
const renamed = (
  config: LoadedConfig,
  { catalog }: PlanResult,
  draft: Catalog,
): ReadonlyArray<AppliedEntry> =>
  catalog !== undefined &&
  record(config.input)?.['catalog_name'] !== undefined &&
  catalog.name !== draft.name
    ? [
        {
          section: 'catalog',
          id: 'name',
          action: 'updated',
          diff: [{ field: 'name', before: draft.name, after: catalog.name }],
        },
      ]
    : []

type DraftComparison = Pick<PlanDraft, 'drift' | 'conflicts'>

const UNCOMPARED: DraftComparison = { drift: null, conflicts: [] }

const compareWithDraft = (
  config: LoadedConfig,
  organization: ActiveOrganization,
  result: PlanResult,
  draft: Catalog,
) =>
  Effect.gen(function* () {
    if (errors(result.issues) > 0) return UNCOMPARED
    const plan = yield* (yield* BillingConfig).plan(config, organization, {
      catalogId: draft.id,
    })
    if (errors(plan.issues) > 0) return UNCOMPARED
    return {
      drift: [
        ...draftedChanges(plan.entries),
        ...renamed(config, result, draft),
      ],
      conflicts: [
        ...draftConflicts(result.entries, plan.entries),
        ...catalogNameConflict(result.catalog, draft),
      ],
    } satisfies DraftComparison
  }).pipe(Effect.orElseSucceed(() => UNCOMPARED))

// Plan compares with the live catalog: an unpublished draft is compared separately
const readCatalogs = (
  config: LoadedConfig,
  organization: ActiveOrganization,
  result: PlanResult,
) =>
  Effect.gen(function* () {
    const { live, draft } = yield* (yield* BillingConfig).catalogs(organization)
    if (draft === null) return { live, draft: null } satisfies PlanCatalogs
    const compared = yield* compareWithDraft(
      config,
      organization,
      result,
      draft,
    )
    return { live, draft: { ...draft, ...compared } } satisfies PlanCatalogs
  }).pipe(Effect.option, Effect.map(Option.getOrUndefined))

const nextStep = (
  config: LoadedConfig,
  organization: ActiveOrganization,
  result: PlanResult,
  catalogs: PlanCatalogs | undefined,
) => {
  if (errors(result.issues) > 0) return next(fixErrors(result.issues))
  if (catalogs?.draft) {
    return next(draftNext(config.file, catalogs.draft, result.entries))
  }
  if (unchanged(result.entries)) {
    return [
      ui.blank,
      ui.success(`${target(organization)} is up to date, nothing to change`),
    ]
  }
  return next(runDraft)
}

const render = (
  config: LoadedConfig,
  organization: ActiveOrganization,
  result: PlanResult,
  catalogs: PlanCatalogs | undefined,
) => [
  ...sections(config, result),
  ...overview(config, organization, result),
  ...(catalogs?.draft && catalogs.draft.conflicts.length > 0
    ? conflictSection(config, catalogs.draft.conflicts)
    : []),
  ...nextStep(config, organization, result, catalogs),
  ui.blank,
]

export const validate = Command.make('validate', { file, org, prComment }).pipe(
  Command.withDescription(
    'Check a billing config file and show what saving it to the draft would change, without changing anything',
  ),
  Command.withExamples([
    {
      command: 'polar config validate',
      description: 'Check polar.config.ts in the current directory',
    },
    {
      command: 'polar config validate billing/polar.json',
      description: 'Check a specific file',
    },
    {
      command: 'polar config validate --org acme',
      description: 'Check against another organization, by slug or ID',
    },
    {
      command: 'polar config validate --json',
      description: 'Print the changes and issues as JSON',
    },
    {
      command: 'polar config validate --pr-comment',
      description:
        'Also post the changes on the pull request being built, in GitHub Actions or Buildkite',
    },
  ]),
  output({
    result: PlanOutput,
    run: ({ file, org, prComment }, { say }) =>
      Effect.gen(function* () {
        const billing = yield* BillingConfig
        const planned = yield* withProgress(
          (progress) =>
            Effect.gen(function* () {
              yield* progress.open('Preflight')
              yield* progress.start('Reading')
              const config = yield* billing.load(Option.getOrUndefined(file))
              yield* progress.finish(config.file)
              yield* progress.start('Found')
              yield* progress.finish(found(config))
              yield* progress.start('Comparing')
              const [elapsed, { organization, result, catalogs }] =
                yield* Effect.timed(
                  Effect.gen(function* () {
                    const organization = yield* (yield* Organizations).resolve(
                      Option.getOrUndefined(org),
                    )
                    const result = yield* billing.plan(config, organization)
                    return {
                      organization,
                      result,
                      catalogs: yield* readCatalogs(
                        config,
                        organization,
                        result,
                      ),
                    }
                  }),
                )
              yield* progress.finish(
                `${Math.round(Duration.toMillis(elapsed))}ms`,
              )
              return { config, organization, result, catalogs }
            }),
          'columns',
        )
        if (prComment) {
          const { config, organization, result, catalogs } = planned
          const posted = yield* commentOnPullRequest(
            `config plan ${organization.id} ${config.file}`,
            planMarkdown(config, organization, result, catalogs),
          )
          yield* say([commented(posted)])
        }
        return planned
      }),
    render: ({ config, organization, result, catalogs }) =>
      render(config, organization, result, catalogs),
    json: ({ config, result, catalogs }) => ({
      file: config.file,
      ...result,
      ...catalogs,
    }),
    failed: ({ config, result }) =>
      errors(result.issues) > 0
        ? new BillingConfigError({
            message: `${config.file} has errors`,
          })
        : undefined,
    telemetry: validateUsage,
  }),
)
