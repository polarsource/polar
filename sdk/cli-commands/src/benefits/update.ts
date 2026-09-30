// Generated from benefits:update (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime, ApiCommandError } from '../runtime'
import {
  data,
  mergeInput,
  missingFlags,
  jsonFlag,
  nullableStringFlag,
} from '../inputs'

type Body = NonNullable<Parameters<Polar['benefits']['update']>[1]>

export const command = Command.make(
  'update',
  {
    path: {
      id: Argument.String('id'),
    },
    data,
    input: {
      metadata: jsonFlag('metadata').pipe(
        Flag.optional,
        Flag.withDescription(
          'Key-value object allowing you to store additional information. JSON: {"<key>": string | integer | number | boolean}',
        ),
      ),
      description: nullableStringFlag('description').pipe(
        Flag.optional,
        Flag.withDescription(
          'The description of the benefit. Will be displayed on products having this benefit.',
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
      properties: jsonFlag('properties').pipe(
        Flag.optional,
        Flag.withDescription(
          'properties JSON: {"note": string | null} | {"guild_id": string, "role_id": string, "kick_member": boolean} | {"repository_owner": string, "repository_name": string, "permission": "pull" | "triage" | "push" | "maintain" | "admin"} | {"files": array of string, ...} | {...} | {"units": integer, "rollover": boolean, "meter_id": string} | {} | {"slack_integration_id": string, "channel_name_template": string, ...}',
        ),
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
      const missing = missingFlags(body, ['type'])
      if (missing.length > 0) {
        return yield* new ApiCommandError({
          message: `Missing required ${missing.length > 1 ? 'flags' : 'flag'} ${missing.join(', ')}`,
          hint: 'Example: polar benefits update <id> --type custom',
        })
      }
      yield* api.execute({
        operationId: 'benefits:update',
        method: 'PATCH',
        requiresConfirmation: false,
        confirm: false,
        invoke: (client) => client.benefits.update(config.path.id, body),
      })
    }),
).pipe(Command.withDescription('Update a benefit.'))
