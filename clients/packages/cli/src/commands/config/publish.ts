import { Effect, Option, Stdio } from 'effect'
import { Command, Prompt } from 'effect/cli'
import type { ActiveOrganization } from '@/schemas/Auth'
import {
  BillingConfigError,
  type Catalog,
  type Catalogs,
  PublishOutput,
} from '@/schemas/BillingConfig'
import { BillingConfig } from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
import { next, section, target } from '@/utils/billing-config/review'
import { type Say, output } from '@/utils/command'
import { confirm as confirmed, org } from '@/utils/flags'
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

const approve = (
  organization: ActiveOrganization,
  json: boolean,
  confirmed: boolean,
) =>
  Effect.gen(function* () {
    if (confirmed) return
    const stdio = yield* Stdio.Stdio
    const interactive =
      (yield* stdio.stdinIsTerminal) && (yield* stdio.stdoutIsTerminal)
    if (json || !interactive) {
      return yield* new BillingConfigError({
        message: `Confirmation needed to publish to ${target(organization)}`,
        hint: 'Pass --confirm to publish without asking.',
      })
    }
    const accepted = yield* Prompt.run(
      Prompt.Confirm({
        message: `Publish the draft to ${target(organization)}? New checkouts sell its products right away.`,
      }),
    ).pipe(Effect.orElseSucceed(() => false))
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

export const publish = Command.make('publish', { org, confirmed }).pipe(
  Command.withDescription(
    "Make your organization's draft catalog live, so new checkouts sell its products and benefits",
  ),
  Command.withExamples([
    {
      command: 'polar config publish',
      description: 'Publish the draft after confirmation',
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
    run: ({ org, confirmed }, { say }: Say) =>
      Effect.gen(function* () {
        const billing = yield* BillingConfig
        const { json } = yield* Output
        const { organization, catalogs } = yield* withProgress(
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
              yield* progress.close
              return { organization, catalogs }
            }),
          'columns',
        )
        if (catalogs.draft === null) {
          return { organization, catalogs, published: false }
        }
        yield* say(summary(organization, catalogs))
        yield* approve(organization, json, confirmed)
        const live = yield* billing.publish(organization, catalogs.draft)
        return {
          organization,
          catalogs: { live, draft: null },
          published: true,
        }
      }),
    render: ({ organization, catalogs, published }) =>
      render(organization, catalogs, published),
    json: ({ catalogs, published }) => ({ ...catalogs, published }),
  }),
)
