// Generated CLI resource command. Do not edit.
import { Command } from 'effect/unstable/cli'
import { command as getEvents } from './get'
import { command as listNamesEvents } from './list_names'

export const command = Command.make('events').pipe(
  Command.withSubcommands([getEvents, listNamesEvents]),
)
