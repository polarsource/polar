// Generated CLI resource command. Do not edit.
import { Command } from 'effect/unstable/cli'
import { command as createCustomFields } from './create'
import { command as deleteCustomFields } from './delete'
import { command as getCustomFields } from './get'
import { command as listCustomFields } from './list'
import { command as updateCustomFields } from './update'

export const command = Command.make('custom_fields').pipe(
  Command.withSubcommands([
    createCustomFields,
    deleteCustomFields,
    getCustomFields,
    listCustomFields,
    updateCustomFields,
  ]),
)
