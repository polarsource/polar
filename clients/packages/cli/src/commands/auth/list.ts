import { Console, Effect } from 'effect'
import { Command } from 'effect/unstable/cli'
import { isSelected, notLoggedIn } from '@/commands/auth/shared'
import { Auth } from '@/services/auth'
import { Organizations } from '@/services/organizations'
import * as ui from '@/utils/ui'

export const list = Command.make('list', {}, () =>
  Effect.gen(function* () {
    const auth = yield* Auth
    const organizations = yield* Organizations
    const environments = yield* auth.environments
    const override = yield* auth.override
    yield* Console.log(ui.blank)
    if (environments.length === 0) return yield* notLoggedIn
    const selection = yield* organizations.selected
    for (const environment of environments) {
      const items = yield* organizations.list(environment)
      yield* Console.log(
        `  ${ui.bold(`Organizations in ${environment}`)}${override ? ui.dim('  via POLAR_ACCESS_TOKEN') : ''}`,
      )
      yield* Console.log(ui.blank)
      if (items.length === 0) {
        yield* Console.log(ui.step('No accessible organizations'))
      }
      const width = Math.max(0, ...items.map((org) => org.name.length))
      for (const org of items) {
        const marker = isSelected(org, selection) ? ui.green('●') : ui.dim('○')
        yield* Console.log(
          `  ${marker} ${org.name.padEnd(width)}  ${ui.dim(org.slug)}  ${ui.dim(org.id)}`,
        )
      }
      yield* Console.log(ui.blank)
    }
  }),
).pipe(Command.withDescription('List the organizations you have access to'))
