// Generated from benefit-grants:update (2027-01). Do not edit.
import type { Polar } from '@polar-sh/sdk/2027-01'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/cli'
import { ApiRuntime } from '../runtime'
import { fields, data, mergeInput, jsonFlag } from '../inputs'

type Body = NonNullable<Parameters<Polar['benefitGrants']['update']>[1]>

export const command = Command.make(
  'update',
  {
    fields,
    path: {
      id: Argument.String('id'),
    },
    data,
    input: {
      manually_revoked_at: jsonFlag('manually-revoked-at').pipe(
        Flag.optional,
        Flag.withDescription(
          'Set to None to undo a manual revocation. JSON: null',
        ),
      ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const body = mergeInput<Body>(config.data, {
        manually_revoked_at: config.input.manually_revoked_at,
      })
      yield* api.execute({
        operationId: 'benefit-grants:update',
        apiVersion: '2027-01',
        method: 'PATCH',
        requiresConfirmation: false,
        confirm: false,
        fields: config.fields,
        invoke: (client) => client.benefitGrants.update(config.path.id, body),
      })
    }),
).pipe(
  Command.withDescription(
    'Undo a manual revocation by setting `manually_revoked_at` to `None`. (preview, API 2027-01)',
  ),
)
