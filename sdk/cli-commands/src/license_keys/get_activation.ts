// Generated from license_keys:get_activation (2026-04). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'

export const command = Command.make(
  'get_activation',
  {
    path: {
      id: Argument.string('id'),
      activation_id: Argument.string('activation_id'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'license_keys:get_activation',
        method: 'GET',
        confirm: false,
        invoke: (client) =>
          client.licenseKeys.getActivation(
            config.path.id,
            config.path.activation_id,
          ),
      })
    }),
).pipe(Command.withDescription('Get a license key activation.'))
