import { Effect, Option, Schema } from 'effect'
import { Command, Prompt } from 'effect/cli'
import { ActiveOrganization } from '@/schemas/Auth'
import { BillingConfigError } from '@/schemas/BillingConfig'
import { BillingConfig } from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
import { next, target } from '@/utils/billing-config/review'
import { type Say, output } from '@/utils/command'
import { confirm as confirmed, org } from '@/utils/flags'
import { Output } from '@/utils/output'
import { interactive } from '@/utils/prompt'
import * as ui from '@/utils/ui'

const DisableOutput = Schema.Struct({
  organization: ActiveOrganization,
  disabled: Schema.Boolean,
})

const approve = (
  organization: ActiveOrganization,
  json: boolean,
  confirmed: boolean,
  say: Say['say'],
) =>
  Effect.gen(function* () {
    if (confirmed) return
    if (json || !(yield* interactive)) {
      return yield* new BillingConfigError({
        message: `Confirmation needed to disable config for ${target(organization)}`,
        hint: 'Pass --confirm to disable without asking.',
      })
    }
    yield* say([
      ui.blank,
      `${ui.INDENT}Your products and benefits stay as they are, and can be edited in the dashboard again.`,
      `${ui.INDENT}Changes in the draft that were not published are discarded.`,
      ui.blank,
    ])
    const accepted = yield* Prompt.run(
      Prompt.Confirm({
        message: `Disable config for ${target(organization)}?`,
        initial: false,
      }),
    ).pipe(Effect.orElseSucceed(() => false))
    if (!accepted) {
      return yield* new BillingConfigError({
        message: 'Disable cancelled, nothing changed',
      })
    }
  })

const render = (organization: ActiveOrganization) => [
  ui.blank,
  ui.success(`Config is disabled for ${target(organization)}`),
  ...next(
    [
      `${ui.INDENT}Edit products and benefits in the dashboard.`,
      `${ui.INDENT}Your config file was left untouched. Remove it if you no longer use config,`,
      `${ui.INDENT}or before running ${ui.command('polar config init')} to start again.`,
    ].join('\n'),
  ),
  ui.blank,
]

export const disable = Command.make('disable', { org, confirmed }).pipe(
  Command.withDescription(
    'Stop managing your catalog with config, so it can be edited in the dashboard again. Only possible until a second catalog is published',
  ),
  Command.withExamples([
    {
      command: 'polar config disable',
      description: 'Disable config after confirmation',
    },
    {
      command: 'polar config disable --org acme --confirm',
      description: 'Disable config for another organization without asking',
    },
  ]),
  output({
    result: DisableOutput,
    run: (
      { org, confirmed }: { org: Option.Option<string>; confirmed: boolean },
      { say }: Say,
    ) =>
      Effect.gen(function* () {
        const { json } = yield* Output
        const organization = yield* (yield* Organizations).resolve(
          Option.getOrUndefined(org),
        )
        yield* approve(organization, json, confirmed, say)
        yield* (yield* BillingConfig).disable(organization)
        return { organization, disabled: true }
      }),
    render: ({ organization }) => render(organization),
  }),
)
