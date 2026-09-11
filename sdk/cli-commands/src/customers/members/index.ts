// Generated CLI resource command. Do not edit.
import { Command } from 'effect/unstable/cli'
import { command as createMembers } from './create'
import { command as createExternalMembers } from './create_external'
import { command as deleteMembers } from './delete'
import { command as deleteExternalMembers } from './delete_external'
import { command as getMembers } from './get'
import { command as getExternalMembers } from './get_external'
import { command as listMembers } from './list'
import { command as listExternalMembers } from './list_external'
import { command as updateMembers } from './update'
import { command as updateExternalMembers } from './update_external'

export const command = Command.make('members').pipe(
  Command.withSubcommands([
    createMembers,
    createExternalMembers,
    deleteMembers,
    deleteExternalMembers,
    getMembers,
    getExternalMembers,
    listMembers,
    listExternalMembers,
    updateMembers,
    updateExternalMembers,
  ]),
)
