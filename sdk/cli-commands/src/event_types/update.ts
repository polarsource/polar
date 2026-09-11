// Generated from event-types:update (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput } from '../inputs'

type Body = NonNullable<Parameters<Polar['eventTypes']['update']>[1]>

export const command = Command.make(
  'update',
  {
    path: {
      id: Argument.string('id'),
    },
    data,
    input: {
      label: Flag.string('label').pipe(
        Flag.optional,
        Flag.withDescription('The label for the event type.'),
      ),
      label_property_selector: Flag.string('label-property-selector').pipe(
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
      yield* api.execute({
        operationId: 'event-types:update',
        method: 'PATCH',
        confirm: false,
        invoke: (client) => client.eventTypes.update(config.path.id, body),
      })
    }),
).pipe(Command.withDescription("Update an event type's label."))
