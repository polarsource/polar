import { Console, Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import {
  chooseEnvironment,
  environmentFlags,
  selectOrganization,
} from '@/commands/auth/shared'
import { loginCommand, type PolarEnvironment } from '@/schemas/Auth'
import { Auth } from '@/services/auth'
import * as ui from '@/utils/ui'

export const login = Command.make(
  'login',
  {
    ...environmentFlags,
    newSession: Flag.boolean('new-session').pipe(
      Flag.withDefault(false),
      Flag.withDescription('Sign in again even if a session is already saved'),
    ),
  },
  ({ newSession, ...flags }) =>
    Effect.gen(function* () {
      const environment = yield* chooseEnvironment(flags, 'log in to')
      const auth = yield* Auth
      const replaced = yield* auth.login(environment, newSession, (url) =>
        Console.log(
          [
            ui.blank,
            ui.step(
              `Opening your browser to sign in to Polar ${environment}...`,
            ),
            ui.step('If it does not open, visit:'),
            `    ${ui.cyan(url)}`,
            ui.blank,
            ui.step('Waiting for you to authorize the CLI...'),
            ui.blank,
          ].join('\n'),
        ),
      )
      if (!replaced) {
        const other: PolarEnvironment =
          environment === 'production' ? 'sandbox' : 'production'
        yield* Console.log(ui.blank)
        yield* Console.log(
          ui.warning(`Already logged in to ${ui.bold(environment)}`),
        )
        yield* Console.log(
          ui.step(
            `Run ${ui.command(`${loginCommand(environment)} --new-session`)} to sign in again`,
          ),
        )
        yield* Console.log(
          ui.step(
            `Run ${ui.command(loginCommand(other))} to sign in to ${other}`,
          ),
        )
        yield* Console.log(ui.blank)
        return
      }
      yield* Console.log(
        ui.success(`Logged in to Polar ${ui.bold(environment)}`),
      )
      yield* Console.log(ui.blank)
      yield* selectOrganization
    }),
).pipe(Command.withDescription('Sign in to Polar through your browser'))
