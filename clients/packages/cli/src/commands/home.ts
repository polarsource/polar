import { Console, Effect, Option } from 'effect'
import {
  loginCommand,
  orgCommand,
  type ActiveOrganization,
} from '@/schemas/Auth'
import { Auth } from '@/services/auth'
import { Organizations } from '@/services/organizations'
import * as ui from '@/utils/ui'
import { VERSION } from '@/version'

const lookup = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.timeout('3 seconds'), Effect.option)

const commandList = (rows: ReadonlyArray<readonly [string, string]>) => {
  const width = Math.max(...rows.map(([command]) => command.length))
  return rows
    .map(
      ([command, description]) =>
        `  ${ui.command(command.padEnd(width))}  ${ui.dim(description)}`,
    )
    .join('\n')
}

const describe = (organization: ActiveOrganization) =>
  `${ui.bold(organization.name)} ${ui.dim(organization.environment)}`

const activeOrganization = (override: boolean) =>
  Effect.gen(function* () {
    const organizations = yield* Organizations
    if (override) {
      const items = yield* lookup(organizations.listAll)
      return Option.map(items, (list) =>
        list.length === 1 ? list[0] : undefined,
      )
    }
    if (!(yield* organizations.selected)) return Option.some(undefined)
    return yield* lookup(organizations.resolve())
  })

const signedIn = Effect.gen(function* () {
  const auth = yield* Auth
  const override = yield* auth.override
  const environments = yield* auth.environments
  if (!override && environments.length === 0) {
    return [
      ui.warning('Not logged in'),
      ui.step(`Run ${ui.command(loginCommand('sandbox'))} to get started`),
    ]
  }
  const organization = yield* activeOrganization(override)
  const rows: Array<readonly [string, string]> = override
    ? [
        ['Token', 'POLAR_ACCESS_TOKEN'],
        ['Environment', environments[0]!],
      ]
    : [['Logged in', environments.join(', ')]]
  if (Option.isNone(organization)) {
    rows.push(['Organization', ui.dim('could not be loaded')])
  } else if (organization.value) {
    rows.push(['Organization', describe(organization.value)])
  }
  const lines = [ui.keyValue(rows)]
  if (Option.isSome(organization) && !organization.value) {
    lines.push(
      ui.blank,
      ui.warning('No active organization'),
      override
        ? ui.step(`Use ${ui.command('--org <id>')} on commands that need one`)
        : ui.step(`Run ${ui.command(orgCommand)} to choose one`),
    )
  }
  const suggestions: Array<readonly [string, string]> = [
    ['polar listen 3000', 'Forward webhooks to your local server'],
    ['polar trigger order.paid', 'Send a sample event'],
  ]
  if (!override) suggestions.push([orgCommand, 'Switch organization'])
  lines.push(ui.blank, `  ${ui.bold('Try next')}`, commandList(suggestions))
  return lines
}).pipe(
  Effect.catch(() =>
    Effect.succeed([
      ui.warning('Could not read your saved session'),
      ui.step(`Run ${ui.command('polar auth whoami')} for details`),
    ]),
  ),
)

export const home = Effect.gen(function* () {
  const lines = yield* signedIn
  yield* Console.log(
    [
      ui.blank,
      `  ${ui.bold('Polar CLI')} ${ui.dim(VERSION)}`,
      ui.blank,
      ...lines,
      ui.blank,
      ui.step(`Run ${ui.command('polar --help')} to see every command`),
      ui.blank,
    ].join('\n'),
  )
})
