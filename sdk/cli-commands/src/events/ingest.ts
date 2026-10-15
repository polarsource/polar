// Generated from events:ingest (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/cli'
import { ApiRuntime, ApiCommandError } from '../runtime'
import { fields, data, mergeInput, missingFlags, jsonFlag } from '../inputs'

type Body = NonNullable<Parameters<Polar['events']['ingest']>[0]>

export const command = Command.make(
  'ingest',
  {
    fields,
    data,
    input: {
      events: jsonFlag('events').pipe(
        Flag.optional,
        Flag.withDescription(
          'Required. List of events to ingest. JSON: array of ({"name": string, "customer_id": string, ...} | {"name": string, "external_customer_id": string, ...})',
        ),
      ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const body = mergeInput<Body>(config.data, {
        events: config.input.events,
      })
      const missing = missingFlags(body, ['events'])
      if (missing.length > 0) {
        return yield* new ApiCommandError({
          message: `Missing required ${missing.length > 1 ? 'flags' : 'flag'} ${missing.join(', ')}`,
          hint: 'Example: polar events ingest --events \'[{"name":"<name>","customer_id":"<customer_id>"}]\'',
        })
      }
      yield* api.execute({
        operationId: 'events:ingest',
        method: 'POST',
        requiresConfirmation: false,
        confirm: false,
        fields: config.fields,
        invoke: (client) => client.events.ingest(body),
      })
    }),
).pipe(Command.withDescription('Ingest batch of events.'))
