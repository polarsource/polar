import { Console, Effect, Stdio } from 'effect'
import { Prompt } from 'effect/unstable/cli'
import {
  AuthError,
  loginCommand,
  orgCommand,
  type ActiveOrganization,
  type OrganizationSelection,
  type PolarEnvironment,
} from '@/schemas/Auth'
import { Organizations } from '@/services/organizations'
import * as ui from '@/utils/ui'
import { production, sandbox } from '@/commands/flags'

export const isSelected = (
  organization: ActiveOrganization,
  selection: OrganizationSelection | undefined,
) =>
  selection?.id === organization.id &&
  selection.environment === organization.environment

export const describe = (organization: ActiveOrganization) =>
  `${ui.bold(organization.name)} ${ui.dim(organization.slug)} ${ui.dim(organization.environment)}`

export const notLoggedIn = Effect.gen(function* () {
  yield* Console.log(ui.warning('Not logged in'))
  yield* Console.log(
    ui.step(
      `Run ${ui.command(loginCommand('sandbox'))} or ${ui.command(loginCommand('production'))}`,
    ),
  )
  yield* Console.log(ui.blank)
})

export const environmentFlags = { sandbox, production }

export const interactive = Effect.gen(function* () {
  const stdio = yield* Stdio.Stdio
  return (yield* stdio.stdinIsTerminal) && (yield* stdio.stdoutIsTerminal)
})

export const chooseEnvironment = (
  flags: { sandbox: boolean; production: boolean },
  action: string,
) =>
  Effect.gen(function* () {
    if (flags.sandbox && flags.production) {
      return yield* new AuthError({
        message: 'Pass either --sandbox or --production, not both.',
      })
    }
    if (flags.production) return 'production' as const
    if (flags.sandbox) return 'sandbox' as const
    if (!(yield* interactive)) {
      return yield* new AuthError({
        message: `Pass --sandbox or --production to ${action} outside an interactive terminal.`,
      })
    }
    return yield* Prompt.select<PolarEnvironment>({
      message: `Which environment do you want to ${action}?`,
      choices: [
        { title: 'Sandbox', value: 'sandbox', description: 'sandbox.polar.sh' },
        { title: 'Production', value: 'production', description: 'polar.sh' },
      ],
    })
  })

export const selectOrganization = Effect.gen(function* () {
  const organizations = yield* Organizations
  const items = yield* organizations.listAll
  if (items.length === 0) {
    yield* Console.log(ui.warning('No organizations yet'))
    yield* Console.log(
      ui.step(
        `Create one at ${ui.cyan('https://polar.sh')} or ${ui.cyan('https://sandbox.polar.sh')}, then run ${ui.command(orgCommand)}`,
      ),
    )
    yield* Console.log(ui.blank)
    return
  }
  if (!(yield* interactive)) {
    yield* Console.log(
      ui.warning('Organization selection requires an interactive terminal'),
    )
    yield* Console.log(
      ui.step(
        `Run ${ui.command(orgCommand)} interactively, or use POLAR_ACCESS_TOKEN with ${ui.command('--org <id>')} in CI`,
      ),
    )
    yield* Console.log(ui.blank)
    return
  }
  const selection = yield* organizations.selected
  const organization = yield* Prompt.select({
    message: 'Select organization',
    choices: items.map((organization) => ({
      value: organization,
      title: `${organization.name} ${ui.dim(organization.environment)}${isSelected(organization, selection) ? ` ${ui.dim('(active)')}` : ''}`,
      description: organization.slug,
    })),
  })
  yield* organizations.select({
    id: organization.id,
    environment: organization.environment,
  })
  yield* Console.log(ui.blank)
  yield* Console.log(
    ui.success(`Active organization ${describe(organization)}`),
  )
  yield* Console.log(ui.blank)
})
