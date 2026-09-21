// Generated CLI resource command. Do not edit.
import { Command } from 'effect/unstable/cli'
import { command as listEventTypes } from './list'
import { command as updateEventTypes } from './update'

export const command = Command.make('event_types').pipe(
  Command.withSubcommands([listEventTypes, updateEventTypes]),
)
