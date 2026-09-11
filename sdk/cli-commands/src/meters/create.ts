// Generated from meters:create (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput, jsonFlag } from '../inputs'

type Body = NonNullable<Parameters<Polar['meters']['create']>[0]>

export const command = Command.make(
  'create',
  {
    data,
    input: {
      metadata: jsonFlag('metadata').pipe(
        Flag.optional,
        Flag.withDescription(
          'Key-value object allowing you to store additional information.',
        ),
      ),
      name: Flag.string('name').pipe(
        Flag.optional,
        Flag.withDescription(
          "The name of the meter. Will be shown on customer's invoices and usage.",
        ),
      ),
      unit: Flag.choice('unit', ['scalar', 'token', 'custom']).pipe(
        Flag.optional,
        Flag.withDescription('unit'),
      ),
      custom_label: Flag.string('custom-label').pipe(
        Flag.optional,
        Flag.withDescription(
          "The label for the custom unit, e.g. 'request'. Required when unit is 'custom'.",
        ),
      ),
      custom_multiplier: Flag.integer('custom-multiplier').pipe(
        Flag.optional,
        Flag.withDescription(
          'The multiplier to convert from the base unit to display scale, e.g. 1000 to display per 1000 units. Defaults to 1 when not provided.',
        ),
      ),
      filter: jsonFlag('filter').pipe(
        Flag.optional,
        Flag.withDescription('filter'),
      ),
      aggregation: jsonFlag('aggregation').pipe(
        Flag.optional,
        Flag.withDescription(
          'The aggregation to apply on the filtered events to calculate the meter.',
        ),
      ),
      organization_id: Flag.string('organization-id').pipe(
        Flag.withAlias('org'),
        Flag.optional,
        Flag.withDescription(
          'The ID of the organization owning the meter. **Required unless you use an organization token.**',
        ),
      ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const body = mergeInput<Body>(config.data, {
        metadata: config.input.metadata,
        name: config.input.name,
        unit: config.input.unit,
        custom_label: config.input.custom_label,
        custom_multiplier: config.input.custom_multiplier,
        filter: config.input.filter,
        aggregation: config.input.aggregation,
        organization_id: config.input.organization_id,
      })
      yield* api.execute({
        operationId: 'meters:create',
        method: 'POST',
        requiresConfirmation: false,
        confirm: false,
        invoke: (client) => client.meters.create(body),
      })
    }),
).pipe(Command.withDescription('Create a meter.'))
