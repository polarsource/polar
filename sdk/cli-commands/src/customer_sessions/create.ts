// Generated from customer-sessions:create (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/cli'
import { ApiRuntime } from '../runtime'
import { fields, data, mergeInput, nullableStringFlag } from '../inputs'

type Body = NonNullable<Parameters<Polar['customerSessions']['create']>[0]>

export const command = Command.make(
  'create',
  {
    fields,
    data,
    input: {
      member_id: nullableStringFlag('member-id').pipe(
        Flag.optional,
        Flag.withDescription(
          'ID of the member to create a session for. When not provided and the organization has `member_model_enabled`, the owner member of the customer will be used for individual customers.',
        ),
      ),
      external_member_id: nullableStringFlag('external-member-id').pipe(
        Flag.optional,
        Flag.withDescription(
          'External ID of the member to create a session for. Alternative to `member_id`.',
        ),
      ),
      return_url: nullableStringFlag('return-url').pipe(
        Flag.optional,
        Flag.withDescription(
          'When set, a back button will be shown in the customer portal to return to this URL.',
        ),
      ),
      customer_id: Flag.String('customer-id').pipe(
        Flag.optional,
        Flag.withDescription('ID of the customer to create a session for.'),
      ),
      external_customer_id: Flag.String('external-customer-id').pipe(
        Flag.optional,
        Flag.withDescription(
          'External ID of the customer to create a session for.',
        ),
      ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const body = mergeInput<Body>(config.data, {
        member_id: config.input.member_id,
        external_member_id: config.input.external_member_id,
        return_url: config.input.return_url,
        customer_id: config.input.customer_id,
        external_customer_id: config.input.external_customer_id,
      })
      yield* api.execute({
        operationId: 'customer-sessions:create',
        method: 'POST',
        requiresConfirmation: false,
        confirm: false,
        fields: config.fields,
        invoke: (client) => client.customerSessions.create(body),
      })
    }),
).pipe(Command.withDescription('Create a customer session.'))
