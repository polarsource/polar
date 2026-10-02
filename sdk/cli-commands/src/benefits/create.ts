// Generated from benefits:create (2026-10). Do not edit.
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

type Body = NonNullable<Parameters<Polar['benefits']['create']>[0]>

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
      type: Flag.Literals('type', [
        'custom',
        'discord',
        'github_repository',
        'downloadables',
        'license_keys',
        'meter_credit',
        'feature_flag',
        'slack_shared_channel',
      ]).pipe(Flag.optional, Flag.withDescription('Required. type')),
      description: Flag.String('description').pipe(
        Flag.optional,
        Flag.withDescription(
          'Required. The description of the benefit. Will be displayed on products having this benefit.',
        ),
      ),
      organization_id: nullableStringFlag('organization-id').pipe(
        Flag.withAlias('org'),
        Flag.optional,
        Flag.withDescription(
          'The ID of the organization owning the benefit. Defaults to the active organization.',
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
        Flag.withDescription(
          'Required. properties JSON: {...} | {"guild_id": string, "role_id": string, "kick_member": boolean} | {"repository_owner": string, "repository_name": string, "permission": "pull" | "triage" | "push" | "maintain" | "admin"} | {"files": array of string, ...} | {"units": integer, "rollover": boolean, "meter_id": string} | {} | {"slack_integration_id": string, "channel_name_template": string, ...}',
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
          type: config.input.type,
          description: config.input.description,
          organization_id: config.input.organization_id,
          visibility: config.input.visibility,
          properties: config.input.properties,
        },
      )
      const missing = missingFlags(body, ['type', 'description', 'properties'])
      if (missing.length > 0) {
        return yield* new ApiCommandError({
          message: `Missing required ${missing.length > 1 ? 'flags' : 'flag'} ${missing.join(', ')}`,
          hint: "Example: polar benefits create --type custom --description <description> --properties '{}'",
        })
      }
      yield* api.execute({
        operationId: 'benefits:create',
        method: 'POST',
        requiresConfirmation: false,
        confirm: false,
        organizationId,
        invoke: (client) => client.benefits.create(body),
      })
    }),
).pipe(Command.withDescription('Create a benefit.'))
