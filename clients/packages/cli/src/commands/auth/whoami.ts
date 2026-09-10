import { Console, Effect } from 'effect'
import { Command } from 'effect/unstable/cli'
import { describe, notLoggedIn } from '@/commands/auth/shared'
import { orgCommand } from '@/schemas/Auth'
import { Auth } from '@/services/auth'
import { Organizations } from '@/services/organizations'
import * as ui from '@/utils/ui'

export const whoami = Command.make('whoami', {}, () =>
  Effect.gen(function* () {
    const auth = yield* Auth
    const organizations = yield* Organizations
    const environments = yield* auth.environments
    yield* Console.log(ui.blank)
    if (yield* auth.override) {
      const rows: Array<readonly [string, string]> = [
        ['Token', 'POLAR_ACCESS_TOKEN'],
        ['Environment', environments[0]!],
      ]
      const items = yield* organizations.listAll
      const organization = items.length === 1 ? items[0] : undefined
      if (organization) {
        rows.push(['Organization', describe(organization)])
        rows.push(['ID', ui.dim(organization.id)])
      }
      yield* Console.log(ui.keyValue(rows))
      if (!organization) {
        yield* Console.log(ui.blank)
        yield* Console.log(ui.warning('No active organization'))
        yield* Console.log(
          ui.step(
            `Use ${ui.command('--org <id>')} on organization-dependent commands`,
          ),
        )
      }
      yield* Console.log(ui.blank)
      return
    }
    if (environments.length === 0) return yield* notLoggedIn
    const rows: Array<readonly [string, string]> = [
      ['Logged in', environments.join(', ')],
    ]
    const selection = yield* organizations.selected
    if (selection) {
      const organization = yield* organizations.resolve()
      rows.push(['Organization', describe(organization)])
      rows.push(['ID', ui.dim(organization.id)])
    }
    yield* Console.log(ui.keyValue(rows))
    if (!selection) {
      yield* Console.log(ui.blank)
      yield* Console.log(ui.warning('No active organization'))
      yield* Console.log(ui.step(`Run ${ui.command(orgCommand)} to choose one`))
    }
    yield* Console.log(ui.blank)
  }),
).pipe(Command.withDescription('Show your sessions and active organization'))
