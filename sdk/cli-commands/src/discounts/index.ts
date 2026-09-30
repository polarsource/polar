// Generated CLI resource command. Do not edit.
import { Command } from 'effect/unstable/cli'
import { command as createDiscounts } from './create'
import { command as deleteDiscounts } from './delete'
import { command as getDiscounts } from './get'
import { command as listDiscounts } from './list'
import { command as updateDiscounts } from './update'

export const command = Command.make('discounts').pipe(
  Command.withSubcommands([
    createDiscounts,
    deleteDiscounts,
    getDiscounts,
    listDiscounts,
    updateDiscounts,
  ]),
)
