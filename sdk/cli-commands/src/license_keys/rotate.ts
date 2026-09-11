// Generated from license_keys:rotate (2026-04). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'

export const command = Command.make(
  'rotate',
  {
    path: {
      id: Argument.string('id'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'license_keys:rotate',
        method: 'POST',
        confirm: false,
        invoke: (client) => client.licenseKeys.rotate(config.path.id),
      })
    }),
).pipe(Command.withDescription('Rotate a license key.'))
