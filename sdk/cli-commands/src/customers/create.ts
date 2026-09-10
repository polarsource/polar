// Generated from customers:create (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { production, data, mergeInput, jsonFlag } from '../inputs'

type Body = NonNullable<Parameters<Polar['customers']['create']>[0]>

export const command = Command.make(
  'create',
  {
    production,
    data,
    metadata: jsonFlag('metadata').pipe(
      Flag.optional,
      Flag.withDescription(
        'Key-value object allowing you to store additional information.',
      ),
    ),
    external_id: Flag.string('external-id').pipe(
      Flag.optional,
      Flag.withDescription(
        "The ID of the customer in your system. This must be unique within the organization. Once set, it can't be updated.",
      ),
    ),
    name: Flag.string('name').pipe(Flag.optional, Flag.withDescription('name')),
    billing_address: jsonFlag('billing-address').pipe(
      Flag.optional,
      Flag.withDescription('billing_address'),
    ),
    tax_id: Flag.string('tax-id').pipe(
      Flag.optional,
      Flag.withDescription('tax_id'),
    ),
    locale: Flag.string('locale').pipe(
      Flag.optional,
      Flag.withDescription('locale'),
    ),
    organization_id: Flag.string('organization-id').pipe(
      Flag.withAlias('org'),
      Flag.optional,
      Flag.withDescription(
        'The ID of the organization owning the customer. **Required unless you use an organization token.**',
      ),
    ),
    owner: jsonFlag('owner').pipe(
      Flag.optional,
      Flag.withDescription(
        "Optional owner member to create with the customer. If not provided, an owner member will be automatically created using the customer's email and name.",
      ),
    ),
    type: Flag.choice('type', ['individual', 'team']).pipe(
      Flag.optional,
      Flag.withDescription('type'),
    ),
    email: Flag.string('email').pipe(
      Flag.optional,
      Flag.withDescription(
        'The email address of the team customer. Optional for team customers \u2014 if omitted, an owner with an email must be provided.',
      ),
    ),
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const body = mergeInput<Body>(config.data, {
        metadata: config.metadata,
        external_id: config.external_id,
        name: config.name,
        billing_address: config.billing_address,
        tax_id: config.tax_id,
        locale: config.locale,
        organization_id: config.organization_id,
        owner: config.owner,
        type: config.type,
        email: config.email,
      })
      yield* api.execute({
        operationId: 'customers:create',
        method: 'POST',
        environment: config.production ? 'production' : 'sandbox',
        confirm: false,
        invoke: (client) => client.customers.create(body),
      })
    }),
).pipe(Command.withDescription('Create a customer.'))
