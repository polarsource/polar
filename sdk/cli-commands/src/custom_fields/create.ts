// Generated from custom-fields:create (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput, jsonFlag } from '../inputs'

type Body = NonNullable<Parameters<Polar['customFields']['create']>[0]>

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
      type: Flag.choice('type', [
        'text',
        'number',
        'date',
        'checkbox',
        'select',
      ]).pipe(Flag.optional, Flag.withDescription('type')),
      slug: Flag.string('slug').pipe(
        Flag.optional,
        Flag.withDescription(
          "Identifier of the custom field. It'll be used as key when storing the value. Must be unique across the organization.It can only contain ASCII letters, numbers and hyphens.",
        ),
      ),
      name: Flag.string('name').pipe(
        Flag.optional,
        Flag.withDescription('Name of the custom field.'),
      ),
      organization_id: Flag.string('organization-id').pipe(
        Flag.withAlias('org'),
        Flag.optional,
        Flag.withDescription(
          'The ID of the organization owning the custom field. **Required unless you use an organization token.**',
        ),
      ),
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
        type: config.input.type,
        slug: config.input.slug,
        name: config.input.name,
        organization_id: config.input.organization_id,
        properties: config.input.properties,
      })
      yield* api.execute({
        operationId: 'custom-fields:create',
        method: 'POST',
        requiresConfirmation: false,
        confirm: false,
        invoke: (client) => client.customFields.create(body),
      })
    }),
).pipe(Command.withDescription('Create a custom field.'))
