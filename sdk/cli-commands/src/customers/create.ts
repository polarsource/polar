// Generated from customers:create (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput, jsonFlag, nullableStringFlag } from '../inputs'

type Body = NonNullable<Parameters<Polar['customers']['create']>[0]>

export const command = Command.make(
  'create',
  {
    data,
    input: {
      metadata: jsonFlag('metadata').pipe(
        Flag.optional,
        Flag.withDescription(
          'Key-value object allowing you to store additional information. JSON: {"<key>": string | integer | number | boolean}',
        ),
      ),
      external_id: nullableStringFlag('external-id').pipe(
        Flag.optional,
        Flag.withDescription(
          "The ID of the customer in your system. This must be unique within the organization. Once set, it can't be updated.",
        ),
      ),
      name: nullableStringFlag('name').pipe(
        Flag.optional,
        Flag.withDescription('name'),
      ),
      billing_address: jsonFlag('billing-address').pipe(
        Flag.optional,
        Flag.withDescription(
          'billing_address JSON: {"country": "AD" | "AE" | "AF" | "AG" | "AI" | ..., ...}',
        ),
      ),
      tax_id: nullableStringFlag('tax-id').pipe(
        Flag.optional,
        Flag.withDescription('tax_id'),
      ),
      locale: nullableStringFlag('locale').pipe(
        Flag.optional,
        Flag.withDescription('locale'),
      ),
      organization_id: nullableStringFlag('organization-id').pipe(
        Flag.withAlias('org'),
        Flag.optional,
        Flag.withDescription(
          'The ID of the organization owning the customer. Defaults to the active organization.',
        ),
      ),
      owner: jsonFlag('owner').pipe(
        Flag.optional,
        Flag.withDescription(
          'Optional owner member to create with the customer. If not provided, an owner member will be automatically created using the customer\'s email and name. JSON: {"email": string, ...}',
        ),
      ),
      type: Flag.Literals('type', ['individual', 'team']).pipe(
        Flag.optional,
        Flag.withDescription('type'),
      ),
      email: nullableStringFlag('email').pipe(
        Flag.optional,
        Flag.withDescription(
          'The email address of the customer. This must be unique within the organization. The email address of the team customer. Optional for team customers \u2014 if omitted, an owner with an email must be provided.',
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
          metadata: config.input.metadata,
          external_id: config.input.external_id,
          name: config.input.name,
          billing_address: config.input.billing_address,
          tax_id: config.input.tax_id,
          locale: config.input.locale,
          organization_id: config.input.organization_id,
          owner: config.input.owner,
          type: config.input.type,
          email: config.input.email,
        },
      )
      yield* api.execute({
        operationId: 'customers:create',
        method: 'POST',
        requiresConfirmation: false,
        confirm: false,
        organizationId,
        invoke: (client) => client.customers.create(body),
      })
    }),
).pipe(Command.withDescription('Create a customer.'))
