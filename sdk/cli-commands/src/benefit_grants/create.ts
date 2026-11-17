// Generated from benefit-grants:create (2027-01). Do not edit.
import type { Polar } from '@polar-sh/sdk/2027-01'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/cli'
import { ApiRuntime } from '../runtime'
import { fields, data, mergeInput, nullableStringFlag } from '../inputs'

type Body = NonNullable<Parameters<Polar['benefitGrants']['create']>[0]>

export const command = Command.make(
  'create',
  {
    fields,
    data,
    input: {
      customer_id: Flag.String('customer-id').pipe(
        Flag.optional,
        Flag.withDescription('The ID of the customer.'),
      ),
      benefit_id: Flag.String('benefit-id').pipe(
        Flag.optional,
        Flag.withDescription('The ID of the benefit.'),
      ),
      member_id: nullableStringFlag('member-id').pipe(
        Flag.optional,
        Flag.withDescription(
          "The ID of the member receiving the benefit. If not provided, the benefit is granted to the customer's owner.",
        ),
      ),
      external_customer_id: Flag.String('external-customer-id').pipe(
        Flag.optional,
        Flag.withDescription('The ID of the customer in your system.'),
      ),
      external_benefit_id: Flag.String('external-benefit-id').pipe(
        Flag.optional,
        Flag.withDescription(
          'The ID of the benefit in your system. Resolves to the current version of the benefit.',
        ),
      ),
      external_member_id: nullableStringFlag('external-member-id').pipe(
        Flag.optional,
        Flag.withDescription(
          "The ID of the member in your system, scoped to the customer. If not provided, the benefit is granted to the customer's owner.",
        ),
      ),
      organization_id: nullableStringFlag('organization-id').pipe(
        Flag.withAlias('org'),
        Flag.optional,
        Flag.withDescription(
          'The ID of the organization owning the customer and benefit. Omit this field when using an organization token. Defaults to the active organization.',
        ),
      ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const { organization_id: organizationId, ...body } = mergeInput<Body>(
        config.data,
        {
          customer_id: config.input.customer_id,
          benefit_id: config.input.benefit_id,
          member_id: config.input.member_id,
          external_customer_id: config.input.external_customer_id,
          external_benefit_id: config.input.external_benefit_id,
          external_member_id: config.input.external_member_id,
          organization_id: config.input.organization_id,
        },
      )
      yield* api.execute({
        operationId: 'benefit-grants:create',
        apiVersion: '2027-01',
        method: 'POST',
        requiresConfirmation: false,
        confirm: false,
        organizationId,
        fields: config.fields,
        invoke: (client) => client.benefitGrants.create(body),
      })
    }),
).pipe(
  Command.withDescription(
    'Manually grant a benefit to a customer or one of their members. (preview, API 2027-01)',
  ),
)
