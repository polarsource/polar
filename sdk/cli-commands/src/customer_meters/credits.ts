// Generated from customer_meters:credits (2027-01). Do not edit.
import type { Polar } from '@polar-sh/sdk/2027-01'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/cli'
import { ApiRuntime, ApiCommandError } from '../runtime'
import {
  confirm,
  fields,
  data,
  mergeInput,
  missingFlags,
  nullableStringFlag,
} from '../inputs'

type Body = NonNullable<Parameters<Polar['customerMeters']['credits']>[0]>

export const command = Command.make(
  'credits',
  {
    confirm,
    fields,
    data,
    input: {
      units: Flag.Int('units').pipe(
        Flag.optional,
        Flag.withDescription('Required. The number of units to credit.'),
      ),
      rollover: Flag.Boolean('rollover').pipe(
        Flag.optional,
        Flag.withDescription(
          'Whether unused credits carry over to the next meter period.',
        ),
      ),
      external_id: nullableStringFlag('external-id').pipe(
        Flag.optional,
        Flag.withDescription(
          "Your unique identifier for this credit. Retrying with the same `external_id` doesn't grant the credit twice.",
        ),
      ),
      customer_id: Flag.String('customer-id').pipe(
        Flag.optional,
        Flag.withDescription('The ID of the customer.'),
      ),
      meter_id: Flag.String('meter-id').pipe(
        Flag.optional,
        Flag.withDescription('The ID of the meter.'),
      ),
      external_customer_id: Flag.String('external-customer-id').pipe(
        Flag.optional,
        Flag.withDescription('The external ID of the customer.'),
      ),
      external_meter_id: Flag.String('external-meter-id').pipe(
        Flag.optional,
        Flag.withDescription(
          'The external ID of the meter, as set by config as code.',
        ),
      ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const body = mergeInput<Body>(config.data, {
        units: config.input.units,
        rollover: config.input.rollover,
        external_id: config.input.external_id,
        customer_id: config.input.customer_id,
        meter_id: config.input.meter_id,
        external_customer_id: config.input.external_customer_id,
        external_meter_id: config.input.external_meter_id,
      })
      const missing = missingFlags(body, ['units'])
      if (missing.length > 0) {
        return yield* new ApiCommandError({
          message: `Missing required ${missing.length > 1 ? 'flags' : 'flag'} ${missing.join(', ')}`,
          hint: 'Example: polar customer_meters credits --units 100',
        })
      }
      yield* api.execute({
        operationId: 'customer_meters:credits',
        apiVersion: '2027-01',
        method: 'POST',
        requiresConfirmation: true,
        confirm: config.confirm,
        fields: config.fields,
        invoke: (client) => client.customerMeters.credits(body),
      })
    }),
).pipe(
  Command.withDescription(
    'Manually grant credits on a customer meter. (preview, API 2027-01)',
  ),
)
