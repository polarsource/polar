// Generated from benefits:update (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput, jsonFlag } from '../inputs'

type Body = NonNullable<Parameters<Polar['benefits']['update']>[1]>

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
      description: Flag.string('description').pipe(
        Flag.optional,
        Flag.withDescription(
          'The description of the benefit. Will be displayed on products having this benefit.',
        ),
      ),
      visibility: Flag.choice('visibility', [
        'draft',
        'private',
        'public',
      ]).pipe(
        Flag.optional,
        Flag.withDescription(
          'The visibility of the benefit in the customer portal.',
        ),
      ),
      type: Flag.choice('type', [
        'custom',
        'discord',
        'github_repository',
        'downloadables',
        'license_keys',
        'meter_credit',
        'feature_flag',
        'slack_shared_channel',
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
        description: config.input.description,
        visibility: config.input.visibility,
        type: config.input.type,
        properties: config.input.properties,
      })
      yield* api.execute({
        operationId: 'benefits:update',
        method: 'PATCH',
        confirm: false,
        invoke: (client) => client.benefits.update(config.path.id, body),
      })
    }),
).pipe(Command.withDescription('Update a benefit.'))
