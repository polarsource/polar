import { commands } from '@polar-sh/cli-commands'
import { Command, GlobalFlag } from 'effect/cli'
import { Output } from '@/utils/output'
import { auth } from '@/commands/auth'
import { config } from '@/commands/config'
import { polar } from '@/commands/home'
import { listen } from '@/commands/listen'
import { trigger } from '@/commands/trigger'
import { update } from '@/commands/update'

// Add new preview commands in this array, e.g [config, newFeature]
const previews = [config].map((command) =>
  command.pipe(Command.withDescription(`${command.description} (preview)`)),
)

export interface ProgramOptions {
  readonly preview: boolean
}

export const program = ({ preview }: ProgramOptions) =>
  polar.pipe(
    Command.withSubcommands([
      {
        group: 'CLI COMMANDS',
        commands: [auth, listen, trigger, update, ...(preview ? previews : [])],
      },
      { group: 'API RESOURCES', commands },
    ]),
    Command.withGlobalFlags([Output]),
  )

export const builtIns = [
  GlobalFlag.Help,
  GlobalFlag.Version,
  GlobalFlag.Completions,
  GlobalFlag.LogLevel,
]
