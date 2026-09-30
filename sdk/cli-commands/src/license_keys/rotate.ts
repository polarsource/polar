// Generated from license_keys:rotate (2026-10). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { confirm } from '../inputs'

export const command = Command.make(
  'rotate',
  {
    confirm,
    path: {
      id: Argument.String('id'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'license_keys:rotate',
        method: 'POST',
        requiresConfirmation: true,
        confirm: config.confirm,
        invoke: (client) => client.licenseKeys.rotate(config.path.id),
      })
    }),
).pipe(Command.withDescription('Rotate a license key.'))
