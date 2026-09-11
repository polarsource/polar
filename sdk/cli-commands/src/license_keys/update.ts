// Generated from license_keys:update (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput } from '../inputs'

type Body = NonNullable<Parameters<Polar['licenseKeys']['update']>[1]>

export const command = Command.make(
  'update',
  {
    path: {
      id: Argument.string('id'),
    },
    data,
    input: {
      status: Flag.choice('status', ['granted', 'revoked', 'disabled']).pipe(
        Flag.optional,
        Flag.withDescription('status'),
      ),
      usage: Flag.integer('usage').pipe(
        Flag.optional,
        Flag.withDescription('usage'),
      ),
      limit_activations: Flag.integer('limit-activations').pipe(
        Flag.optional,
        Flag.withDescription('limit_activations'),
      ),
      limit_usage: Flag.integer('limit-usage').pipe(
        Flag.optional,
        Flag.withDescription('limit_usage'),
      ),
      expires_at: Flag.string('expires-at').pipe(
        Flag.optional,
        Flag.withDescription('expires_at'),
      ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const body = mergeInput<Body>(config.data, {
        status: config.input.status,
        usage: config.input.usage,
        limit_activations: config.input.limit_activations,
        limit_usage: config.input.limit_usage,
        expires_at: config.input.expires_at,
      })
      yield* api.execute({
        operationId: 'license_keys:update',
        method: 'PATCH',
        requiresConfirmation: false,
        confirm: false,
        invoke: (client) => client.licenseKeys.update(config.path.id, body),
      })
    }),
).pipe(Command.withDescription('Update a license key.'))
