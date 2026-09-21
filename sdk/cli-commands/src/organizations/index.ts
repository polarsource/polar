// Generated CLI resource command. Do not edit.
import { Command } from 'effect/unstable/cli'
import { command as getOrganizations } from './get'
import { command as listOrganizations } from './list'

export const command = Command.make('organizations').pipe(
  Command.withSubcommands([getOrganizations, listOrganizations]),
)
