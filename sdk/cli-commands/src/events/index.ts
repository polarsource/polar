// Generated CLI resource command. Do not edit.
import { Command } from 'effect/cli'
import { command as getEvents } from './get'
import { command as ingestEvents } from './ingest'
import { command as listEvents } from './list'
import { command as listNamesEvents } from './list_names'

export const command = Command.make('events').pipe(
  Command.withSubcommands([
    getEvents,
    ingestEvents,
    listEvents,
    listNamesEvents,
  ]),
)
