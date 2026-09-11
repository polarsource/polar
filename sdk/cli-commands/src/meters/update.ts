// Generated from meters:update (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput, jsonFlag } from '../inputs'

type Body = NonNullable<Parameters<Polar['meters']['update']>[1]>

export const command = Command.make(
  'update',
  {
    path: {
      id: Argument.string('id'),
    },
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
        Flag.withDescription('The unit of the meter.'),
      ),
      custom_label: Flag.string('custom-label').pipe(
        Flag.optional,
        Flag.withDescription(
          "The label for the custom unit. Required when unit is 'custom'.",
        ),
      ),
      custom_multiplier: Flag.integer('custom-multiplier').pipe(
        Flag.optional,
        Flag.withDescription(
          "The multiplier to convert from base unit to display scale. Required when unit is 'custom'.",
        ),
      ),
      filter: jsonFlag('filter').pipe(
        Flag.optional,
        Flag.withDescription(
          "The filter to apply on events that'll be used to calculate the meter.",
        ),
      ),
      aggregation: jsonFlag('aggregation').pipe(
        Flag.optional,
        Flag.withDescription(
          'The aggregation to apply on the filtered events to calculate the meter.',
        ),
      ),
      is_archived: Flag.boolean('is-archived').pipe(
        Flag.optional,
        Flag.withDescription(
          'Whether the meter is archived. Archived meters are no longer used for billing.',
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
        is_archived: config.input.is_archived,
      })
      yield* api.execute({
        operationId: 'meters:update',
        method: 'PATCH',
        confirm: false,
        invoke: (client) => client.meters.update(config.path.id, body),
      })
    }),
).pipe(Command.withDescription('Update a meter.'))
