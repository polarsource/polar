import { Console, Effect } from 'effect'
import { Command, Flag, Prompt } from 'effect/unstable/cli'
import { environmentFlags, interactive } from '@/commands/auth/shared'
import { AuthError, environments, type PolarEnvironment } from '@/schemas/Auth'
import { Auth } from '@/services/auth'
import * as ui from '@/utils/ui'

const logoutTargets = (flags: {
  sandbox: boolean
  production: boolean
  all: boolean
}) =>
  Effect.gen(function* () {
    if (flags.all) return [...environments]
    if (flags.sandbox || flags.production) {
      return environments.filter((environment) => flags[environment])
    }
    if (!(yield* interactive)) {
      return yield* new AuthError({
        message:
          'Pass --sandbox, --production or --all to log out outside an interactive terminal.',
      })
    }
    const auth = yield* Auth
    const sessions = yield* auth.environments
    if (sessions.length === 0) return []
    const choices = sessions.map((environment) => ({
      title: environment === 'production' ? 'Production' : 'Sandbox',
      value: [environment] as PolarEnvironment[],
    }))
    if (sessions.length > 1) {
      choices.push({ title: 'All sessions', value: [...sessions] })
    }
    return yield* Prompt.select({
      message: 'Which session do you want to log out of?',
      choices,
    })
  })

export const logout = Command.make(
  'logout',
  {
    ...environmentFlags,
    all: Flag.boolean('all').pipe(
      Flag.withDefault(false),
      Flag.withDescription('Remove every saved session'),
    ),
  },
  (flags) =>
    Effect.gen(function* () {
      const auth = yield* Auth
      yield* Console.log(ui.blank)
      if (yield* auth.override) {
        yield* Console.log(ui.warning('POLAR_ACCESS_TOKEN remains active'))
        yield* Console.log(
          ui.step(
            'Unset it to stop using the override, only saved sessions are removed',
          ),
        )
      }
      const targets = yield* logoutTargets(flags)
      const deleted = yield* auth.logout(targets)
      for (const environment of targets) {
        yield* Console.log(
          deleted.includes(environment)
            ? ui.success(`Logged out of Polar ${ui.bold(environment)}`)
            : ui.step(`Already logged out of ${environment}`),
        )
      }
      if (targets.length === 0) {
        yield* Console.log(ui.step('Already logged out'))
      }
      yield* Console.log(ui.blank)
    }),
).pipe(Command.withDescription('Sign out and remove saved sessions'))
