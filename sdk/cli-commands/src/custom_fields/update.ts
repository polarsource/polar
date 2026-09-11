// Generated from custom-fields:update (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput, jsonFlag } from '../inputs'

type Body = NonNullable<Parameters<Polar['customFields']['update']>[1]>

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
        Flag.withDescription('name'),
      ),
      slug: Flag.string('slug').pipe(
        Flag.optional,
        Flag.withDescription('slug'),
      ),
      type: Flag.choice('type', [
        'text',
        'number',
        'date',
        'checkbox',
        'select',
      ]).pipe(Flag.optional, Flag.withDescription('type')),
      properties: jsonFlag('properties').pipe(
        Flag.optional,
        Flag.withDescription('properties'),
      ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const body = mergeInput<Body>(config.data, {
        metadata: config.input.metadata,
        name: config.input.name,
        slug: config.input.slug,
        type: config.input.type,
        properties: config.input.properties,
      })
      yield* api.execute({
        operationId: 'custom-fields:update',
        method: 'PATCH',
        requiresConfirmation: false,
        confirm: false,
        invoke: (client) => client.customFields.update(config.path.id, body),
      })
    }),
).pipe(Command.withDescription('Update a custom field.'))
