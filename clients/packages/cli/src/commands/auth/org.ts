import { Effect } from 'effect'
import { Command } from 'effect/unstable/cli'
import { selectOrganization } from '@/commands/auth/shared'
import { AuthError, loginCommand } from '@/schemas/Auth'
import { Auth } from '@/services/auth'

export const org = Command.make('org', {}, () =>
  Effect.gen(function* () {
    const auth = yield* Auth
    if (yield* auth.override) {
      return yield* new AuthError({
        message: 'Unset POLAR_ACCESS_TOKEN to manage saved sessions.',
      })
    }
    if ((yield* auth.environments).length === 0) {
      return yield* new AuthError({
        message: `Not logged in. Run ${loginCommand('sandbox')} or ${loginCommand('production')}.`,
      })
    }
    yield* selectOrganization
  }),
).pipe(Command.withDescription('Choose the active organization'))
