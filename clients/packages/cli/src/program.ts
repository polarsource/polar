import { commands } from '@polar-sh/cli-commands'
import { Command, GlobalFlag } from 'effect/cli'
import { Help } from '@/utils/help'
import { Output } from '@/utils/output'
import { agent } from '@/commands/agent'
import { auth } from '@/commands/auth'
import { config } from '@/commands/config'
import { polar } from '@/commands/home'
import { setup } from '@/commands/setup'
import { update } from '@/commands/update'
import { webhook } from '@/commands/webhook'

const asPreview = <Name extends string, Input, ContextInput, E, R>(
  command: Command.Command<Name, Input, ContextInput, E, R>,
) => command.pipe(Command.withDescription(`${command.description} (preview)`))

// Add new preview commands in this array, e.g [asPreview(config), asPreview(newFeature)]
const previews = [asPreview(config), asPreview(setup)]

interface ProgramOptions {
  readonly preview: boolean
}

export const program = ({ preview }: ProgramOptions) =>
  polar.pipe(
    Command.withSubcommands([
      {
        group: 'CLI COMMANDS',
        commands: [auth, agent, webhook, update, ...(preview ? previews : [])],
      },
      { group: 'API RESOURCES', commands },
    ]),
    Command.withGlobalFlags([Output]),
  )

const sharedBuiltIns = [
  GlobalFlag.Version,
  GlobalFlag.Completions,
  GlobalFlag.LogLevel,
]

export const builtIns = [Help, ...sharedBuiltIns]

export const referenceBuiltIns = [GlobalFlag.Help, ...sharedBuiltIns]
