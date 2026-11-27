import { Effect, Option, Schema } from 'effect'
import { Command, Prompt } from 'effect/cli'
import type { ActiveOrganization } from '@/schemas/Auth'
import { BillingConfigError } from '@/schemas/BillingConfig'
import {
  BillingConfig,
  type ResetPending,
} from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
import { target } from '@/utils/billing-config/review'
import { type Say, output } from '@/utils/command'
import { confirm as confirmed, configFile as file, org } from '@/utils/flags'
import { Output } from '@/utils/output'
import { interactive } from '@/utils/prompt'
import * as ui from '@/utils/ui'

const ResetOutput = Schema.Struct({
  file: Schema.String,
  source: Schema.Literals(['draft', 'live']),
  status: Schema.Literals(['reset', 'unchanged']),
})

const origin = (
  { source }: Pick<ResetPending, 'source'>,
  organization: ActiveOrganization,
) =>
  `the ${source === 'draft' ? 'draft' : 'live catalog'} of ${target(organization)}`

const approve =
  (
    organization: ActiveOrganization,
    json: boolean,
    confirmed: boolean,
    say: Say['say'],
  ) =>
  (pending: ResetPending) =>
    Effect.gen(function* () {
      if (confirmed) return
      if (json || !(yield* interactive)) {
        return yield* new BillingConfigError({
          message: `Confirmation needed to overwrite ${pending.file}`,
          hint: 'Pass --confirm to overwrite without asking.',
        })
      }
      yield* say([
        ui.blank,
        `${ui.INDENT}${pending.file} is rewritten from ${origin(pending, organization)}.`,
        `${ui.INDENT}Anything in the file that is not on Polar is lost, including comments.`,
        ui.blank,
      ])
      const accepted = yield* Prompt.run(
        Prompt.Confirm({
          message: `Overwrite ${pending.file}?`,
          initial: false,
        }),
      ).pipe(Effect.orElseSucceed(() => false))
      if (!accepted) {
        return yield* new BillingConfigError({
          message: 'Reset cancelled, nothing changed',
        })
      }
    })

export const reset = Command.make('reset', { file, org, confirmed }).pipe(
  Command.withDescription(
    'Rewrite your billing config file to match what is on Polar: the draft if there is one, the live catalog otherwise',
  ),
  Command.withExamples([
    {
      command: 'polar config reset',
      description:
        'Replace polar.config.ts with the draft on Polar, after confirmation',
    },
    {
      command: 'polar config reset billing/polar.json',
      description: 'Reset a specific file',
    },
    {
      command: 'polar config reset --org acme --confirm',
      description: 'Reset from another organization without asking',
    },
  ]),
  output({
    result: ResetOutput,
    run: ({ file, org, confirmed }, { say }) =>
      Effect.gen(function* () {
        const { json } = yield* Output
        const organization = yield* (yield* Organizations).resolve(
          Option.getOrUndefined(org),
        )
        const result = yield* (yield* BillingConfig).reset(
          organization,
          Option.getOrUndefined(file),
          approve(organization, json, confirmed, say),
        )
        return { organization, result }
      }),
    render: ({ organization, result }) => [
      ui.blank,
      ui.success(
        result.status === 'unchanged'
          ? `${result.file} already matches ${origin(result, organization)}`
          : `${result.file} now matches ${origin(result, organization)}`,
      ),
      ui.blank,
    ],
    json: ({ result }) => result,
  }),
)
