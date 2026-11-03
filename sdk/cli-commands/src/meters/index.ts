// Generated CLI resource command. Do not edit.
import { Command } from 'effect/cli'
import { command as createMeters } from './create'
import { command as getMeters } from './get'
import { command as getExternalMeters } from './get_external'
import { command as listMeters } from './list'
import { command as quantitiesMeters } from './quantities'
import { command as updateMeters } from './update'

export const command = Command.make('meters').pipe(
  Command.withSubcommands([
    createMeters,
    getMeters,
    getExternalMeters,
    listMeters,
    quantitiesMeters,
    updateMeters,
  ]),
)
