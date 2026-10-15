// Generated CLI resource command. Do not edit.
import { Command } from 'effect/cli'
import { command as createCustomerSessions } from './create'

export const command = Command.make('customer_sessions').pipe(
  Command.withSubcommands([createCustomerSessions]),
)
