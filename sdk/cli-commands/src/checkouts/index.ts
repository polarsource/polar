// Generated CLI resource command. Do not edit.
import { Command } from 'effect/unstable/cli'
import { command as getCheckouts } from './get'
import { command as listCheckouts } from './list'

export const command = Command.make('checkouts').pipe(
  Command.withSubcommands([getCheckouts, listCheckouts]),
)
