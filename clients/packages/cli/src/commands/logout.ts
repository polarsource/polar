import { Console, Effect } from 'effect'
import { Command } from 'effect/unstable/cli'
import * as OAuth from '../services/oauth'

export const logout = Command.make('logout', {}, () =>
  Effect.gen(function* () {
    const oauth = yield* OAuth.OAuth
    yield* oauth.logout()
    yield* Console.log('Successfully logged out of Polar')
  }),
)
