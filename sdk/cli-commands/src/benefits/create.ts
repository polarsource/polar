// Generated from benefits:create (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput, jsonFlag, nullableStringFlag } from '../inputs'

type Body = NonNullable<Parameters<Polar['benefits']['create']>[0]>

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
      type: Flag.Literals('type', [
        'custom',
        'discord',
        'github_repository',
        'downloadables',
        'license_keys',
        'meter_credit',
        'feature_flag',
        'slack_shared_channel',
      ]).pipe(Flag.optional, Flag.withDescription('type')),
      description: Flag.String('description').pipe(
        Flag.optional,
        Flag.withDescription(
          'The description of the benefit. Will be displayed on products having this benefit.',
        ),
      ),
      organization_id: nullableStringFlag('organization-id').pipe(
        Flag.withAlias('org'),
        Flag.optional,
        Flag.withDescription(
          'The ID of the organization owning the benefit. **Required unless you use an organization token.**',
        ),
      ),
      visibility: Flag.Literals('visibility', [
        'draft',
        'private',
        'public',
      ]).pipe(
        Flag.optional,
        Flag.withDescription(
          'The visibility of the benefit in the customer portal.',
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
        description: config.input.description,
        organization_id: config.input.organization_id,
        visibility: config.input.visibility,
        properties: config.input.properties,
      })
      yield* api.execute({
        operationId: 'benefits:create',
        method: 'POST',
        requiresConfirmation: false,
        confirm: false,
        organizationId: body.organization_id,
        invoke: (client, organizationId) =>
          client.benefits.create({ organization_id: organizationId, ...body }),
      })
    }),
).pipe(Command.withDescription('Create a benefit.'))
