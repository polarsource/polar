// Generated from meters:update (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect, Schema } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime, ApiCommandError } from '../runtime'
import {
  confirm,
  data,
  mergeInput,
  jsonFlag,
  nullableStringFlag,
} from '../inputs'

type Body = NonNullable<Parameters<Polar['meters']['update']>[1]>

export const command = Command.make(
  'update',
  {
    confirm,
    path: {
      id: Argument.String('id'),
    },
    data,
    input: {
      metadata: jsonFlag('metadata').pipe(
        Flag.optional,
        Flag.withDescription(
          'Key-value object allowing you to store additional information. JSON: {"<key>": string | integer | number | boolean}',
        ),
      ),
      name: nullableStringFlag('name').pipe(
        Flag.optional,
        Flag.withDescription(
          "The name of the meter. Will be shown on customer's invoices and usage.",
        ),
      ),
      unit: Flag.Literals('unit', ['scalar', 'token', 'custom']).pipe(
        Flag.optional,
        Flag.withDescription('The unit of the meter.'),
      ),
      custom_label: nullableStringFlag('custom-label').pipe(
        Flag.optional,
        Flag.withDescription(
          "The label for the custom unit. Required when unit is 'custom'.",
        ),
      ),
      custom_multiplier: Flag.Int('custom-multiplier').pipe(
        Flag.optional,
        Flag.withDescription(
          "The multiplier to convert from base unit to display scale. Required when unit is 'custom'.",
        ),
      ),
      filter: jsonFlag('filter').pipe(
        Flag.optional,
        Flag.withDescription(
          'The filter to apply on events that\'ll be used to calculate the meter. JSON: {"conjunction": "and" | "or", "clauses": array of ({"property": string, "operator": "eq" | "ne" | "gt" | "gte" | "lt" | ..., "value": string | integer | boolean} | {"conjunction": "and" | "or", "clauses": array of {...}})}',
        ),
      ),
      aggregation: jsonFlag('aggregation').pipe(
        Flag.optional,
        Flag.withDescription(
          'The aggregation to apply on the filtered events to calculate the meter. JSON: {"func": "count"} | {"func": "sum" | "max" | "min" | "avg", "property": string} | {"func": "unique", "property": string}',
        ),
      ),
      is_archived: Flag.Boolean('is-archived').pipe(
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
      const confirmationInput = yield* Schema.decodeUnknownEffect(
        Schema.Struct({
          is_archived: Schema.optionalKey(Schema.NullOr(Schema.Boolean)),
        }),
      )(body).pipe(
        Effect.mapError(
          (error) => new ApiCommandError({ message: error.message }),
        ),
      )
      yield* api.execute({
        operationId: 'meters:update',
        method: 'PATCH',
        requiresConfirmation: confirmationInput['is_archived'] === true,
        confirm: config.confirm,
        preview: {
          fields: [
            { key: 'id', label: 'ID' },
            { key: 'name', label: 'Name' },
            { key: 'unit', label: 'Unit' },
          ],
          invoke: (client) => client.meters.get(config.path.id),
        },
        invoke: (client) => client.meters.update(config.path.id, body),
      })
    }),
).pipe(Command.withDescription('Update a meter.'))
