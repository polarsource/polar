// Generated CLI resource command. Do not edit.
import { Command } from 'effect/unstable/cli'
import { command as deleteFiles } from './delete'
import { command as listFiles } from './list'

export const command = Command.make('files').pipe(
  Command.withSubcommands([deleteFiles, listFiles]),
)
