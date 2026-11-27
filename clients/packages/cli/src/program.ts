import { commands } from '@polar-sh/cli-commands'
import { Command, GlobalFlag } from 'effect/cli'
import { Help } from '@/utils/help'
import { Output } from '@/utils/output'
import { agent } from '@/commands/agent'
import { auth } from '@/commands/auth'
import { config } from '@/commands/config'
import { polar } from '@/commands/home'
import { update } from '@/commands/update'
import { webhook } from '@/commands/webhook'

const cliCommands = [auth, agent, config, webhook, update]

export const programWithout = (hidden: ReadonlyArray<string>) =>
  polar.pipe(
    Command.withSubcommands([
      {
        group: 'CLI COMMANDS',
        commands: cliCommands.filter(({ name }) => !hidden.includes(name)),
      },
      { group: 'API RESOURCES', commands },
    ]),
    Command.withGlobalFlags([Output]),
  )

export const program = programWithout([])

const sharedBuiltIns = [
  GlobalFlag.Version,
  GlobalFlag.Completions,
  GlobalFlag.LogLevel,
]

export const builtIns = [Help, ...sharedBuiltIns]

export const referenceBuiltIns = [GlobalFlag.Help, ...sharedBuiltIns]
