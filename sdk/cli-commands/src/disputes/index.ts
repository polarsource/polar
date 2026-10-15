// Generated CLI resource command. Do not edit.
import { Command } from 'effect/cli'
import { command as getDisputes } from './get'
import { command as listDisputes } from './list'

export const command = Command.make('disputes').pipe(
  Command.withSubcommands([getDisputes, listDisputes]),
)
