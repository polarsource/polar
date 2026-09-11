// Generated CLI resource command. Do not edit.
import { Command } from 'effect/unstable/cli'
import { command as getSubscriptions } from './get'
import { command as listSubscriptions } from './list'
import { command as revokeSubscriptions } from './revoke'
import { command as updateSubscriptions } from './update'

export const command = Command.make('subscriptions').pipe(
  Command.withSubcommands([
    getSubscriptions,
    listSubscriptions,
    revokeSubscriptions,
    updateSubscriptions,
  ]),
)
