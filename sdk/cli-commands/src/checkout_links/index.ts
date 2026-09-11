// Generated CLI resource command. Do not edit.
import { Command } from 'effect/unstable/cli'
import { command as createCheckoutLinks } from './create'
import { command as deleteCheckoutLinks } from './delete'
import { command as getCheckoutLinks } from './get'
import { command as listCheckoutLinks } from './list'
import { command as updateCheckoutLinks } from './update'

export const command = Command.make('checkout_links').pipe(
  Command.withSubcommands([
    createCheckoutLinks,
    deleteCheckoutLinks,
    getCheckoutLinks,
    listCheckoutLinks,
    updateCheckoutLinks,
  ]),
)
