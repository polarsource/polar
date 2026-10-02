// Generated from meters:create (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime, ApiCommandError } from '../runtime'
import {
  data,
  mergeInput,
  missingFlags,
  jsonFlag,
  nullableStringFlag,
} from '../inputs'

type Body = NonNullable<Parameters<Polar['meters']['create']>[0]>

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
      name: Flag.String('name').pipe(
        Flag.optional,
        Flag.withDescription(
          "Required. The name of the meter. Will be shown on customer's invoices and usage.",
        ),
      ),
      unit: Flag.Literals('unit', ['scalar', 'token', 'custom']).pipe(
        Flag.optional,
        Flag.withDescription('The unit of the meter.'),
      ),
      custom_label: nullableStringFlag('custom-label').pipe(
        Flag.optional,
        Flag.withDescription(
          "The label for the custom unit, e.g. 'request'. Required when unit is 'custom'.",
        ),
      ),
      custom_multiplier: Flag.Int('custom-multiplier').pipe(
        Flag.optional,
        Flag.withDescription(
          'The multiplier to convert from the base unit to display scale, e.g. 1000 to display per 1000 units. Defaults to 1 when not provided.',
        ),
      ),
      filter: jsonFlag('filter').pipe(
        Flag.optional,
        Flag.withDescription(
          'Required. The filter to apply on events that\'ll be used to calculate the meter. JSON: {"conjunction": "and" | "or", "clauses": array of ({"property": string, "operator": "eq" | "ne" | "gt" | "gte" | "lt" | ..., "value": string | integer | boolean} | {"conjunction": "and" | "or", "clauses": array of {...}})}',
        ),
      ),
      aggregation: jsonFlag('aggregation').pipe(
        Flag.optional,
        Flag.withDescription(
          'Required. The aggregation to apply on the filtered events to calculate the meter. JSON: {"func": "count"} | {"func": "sum" | "max" | "min" | "avg", "property": string} | {"func": "unique", "property": string}',
        ),
      ),
      organization_id: nullableStringFlag('organization-id').pipe(
        Flag.withAlias('org'),
        Flag.optional,
        Flag.withDescription(
          'The ID of the organization owning the meter. Defaults to the active organization.',
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
          name: config.input.name,
          unit: config.input.unit,
          custom_label: config.input.custom_label,
          custom_multiplier: config.input.custom_multiplier,
          filter: config.input.filter,
          aggregation: config.input.aggregation,
          organization_id: config.input.organization_id,
        },
      )
      const missing = missingFlags(body, ['name', 'filter', 'aggregation'])
      if (missing.length > 0) {
        return yield* new ApiCommandError({
          message: `Missing required ${missing.length > 1 ? 'flags' : 'flag'} ${missing.join(', ')}`,
          hint: 'Example: polar meters create --name <name> --filter \'{"conjunction":"and","clauses":[{"property":"<property>","operator":"eq","value":"<value>"}]}\' --aggregation \'{"func":"count"}\'',
        })
      }
      yield* api.execute({
        operationId: 'meters:create',
        method: 'POST',
        requiresConfirmation: false,
        confirm: false,
        organizationId,
        invoke: (client) => client.meters.create(body),
      })
    }),
).pipe(Command.withDescription('Create a meter.'))
