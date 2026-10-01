import { commands } from '@polar-sh/cli-commands'
import { Command, GlobalFlag } from 'effect/unstable/cli'
import { auth } from '@/commands/auth'
import { home } from '@/commands/home'
import { listen } from '@/commands/listen'
import { trigger } from '@/commands/trigger'
import { update } from '@/commands/update'

export const polar = Command.make('polar', {}, () => home).pipe(
  Command.withSubcommands([
    { group: 'CLI COMMANDS', commands: [auth, listen, trigger, update] },
    { group: 'API RESOURCES', commands },
  ]),
)

export const builtIns = [
  GlobalFlag.Help,
  GlobalFlag.Version,
  GlobalFlag.Completions,
  GlobalFlag.LogLevel,
]
