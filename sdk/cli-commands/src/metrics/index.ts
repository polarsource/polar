// Generated CLI resource command. Do not edit.
import { Command } from 'effect/unstable/cli'
import { command as getMetrics } from './get'
import { command as limitsMetrics } from './limits'

export const command = Command.make('metrics').pipe(
  Command.withSubcommands([getMetrics, limitsMetrics]),
)
