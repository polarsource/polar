// Generated CLI resource command. Do not edit.
import { Command } from 'effect/unstable/cli'
import { command as getCustomerMeters } from './get'
import { command as listCustomerMeters } from './list'

export const command = Command.make('customer_meters').pipe(
  Command.withSubcommands([getCustomerMeters, listCustomerMeters]),
)
