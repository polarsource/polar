// Generated CLI resource command. Do not edit.
import { Command } from 'effect/unstable/cli'
import { command as getPayments } from './get'
import { command as listPayments } from './list'

export const command = Command.make('payments').pipe(
  Command.withSubcommands([getPayments, listPayments]),
)
