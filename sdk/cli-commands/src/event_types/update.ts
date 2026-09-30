// Generated from event-types:update (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime, ApiCommandError } from '../runtime'
import { data, mergeInput, missingFlags, nullableStringFlag } from '../inputs'

type Body = NonNullable<Parameters<Polar['eventTypes']['update']>[1]>

export const command = Command.make(
  'update',
  {
    path: {
      id: Argument.String('id'),
    },
    data,
    input: {
      label: Flag.String('label').pipe(
        Flag.optional,
        Flag.withDescription('Required. The label for the event type.'),
      ),
      label_property_selector: nullableStringFlag(
        'label-property-selector',
      ).pipe(
        Flag.optional,
        Flag.withDescription(
          "Property path to extract dynamic label from event metadata (e.g., 'subject' or 'metadata.subject').",
        ),
      ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const body = mergeInput<Body>(config.data, {
        label: config.input.label,
        label_property_selector: config.input.label_property_selector,
      })
      const missing = missingFlags(body, ['label'])
      if (missing.length > 0) {
        return yield* new ApiCommandError({
          message: `Missing required ${missing.length > 1 ? 'flags' : 'flag'} ${missing.join(', ')}`,
          hint: 'Example: polar event_types update <id> --label <label>',
        })
      }
      yield* api.execute({
        operationId: 'event-types:update',
        method: 'PATCH',
        requiresConfirmation: false,
        confirm: false,
        invoke: (client) => client.eventTypes.update(config.path.id, body),
      })
    }),
).pipe(Command.withDescription("Update an event type's label."))
