import { commands } from '@polar-sh/cli-commands'
import { Command, GlobalFlag } from 'effect/unstable/cli'
import { auth } from '@/commands/auth'
import { config } from '@/commands/config'
import { home } from '@/commands/home'
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
  Command.make('polar', {}, () => home).pipe(
    Command.withSubcommands([
      {
        group: 'CLI COMMANDS',
        commands: [auth, listen, trigger, update, ...(preview ? previews : [])],
      },
      { group: 'API RESOURCES', commands },
    ]),
  )

export const builtIns = [
  GlobalFlag.Help,
  GlobalFlag.Version,
  GlobalFlag.Completions,
  GlobalFlag.LogLevel,
]
