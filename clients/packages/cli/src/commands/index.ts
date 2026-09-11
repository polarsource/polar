import { Command, GlobalFlag } from 'effect/unstable/cli'
import { auth } from '@/commands/auth'
import { listen } from '@/commands/listen'
import { trigger } from '@/commands/trigger'
import { update } from '@/commands/update'

export const polar = Command.make('polar').pipe(
  Command.withSubcommands([auth, listen, trigger, update]),
)

export const builtIns = [
  GlobalFlag.Help,
  GlobalFlag.Version,
  GlobalFlag.Completions,
  GlobalFlag.LogLevel,
]
