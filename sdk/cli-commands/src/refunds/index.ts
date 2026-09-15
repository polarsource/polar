// Generated CLI resource command. Do not edit.
import { Command } from 'effect/unstable/cli'
import { command as createRefunds } from './create'
import { command as listRefunds } from './list'

export const command = Command.make('refunds').pipe(
  Command.withSubcommands([createRefunds, listRefunds]),
)
