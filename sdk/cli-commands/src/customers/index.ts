// Generated CLI resource command. Do not edit.
import { Command } from 'effect/unstable/cli'
import { command as createCustomers } from './create'
import { command as deleteCustomers } from './delete'
import { command as deleteExternalCustomers } from './delete_external'
import { command as getCustomers } from './get'
import { command as getExternalCustomers } from './get_external'
import { command as getStateCustomers } from './get_state'
import { command as getStateExternalCustomers } from './get_state_external'
import { command as listCustomers } from './list'
import { command as listPaymentMethodsCustomers } from './list_payment_methods'
import { command as listPaymentMethodsExternalCustomers } from './list_payment_methods_external'
import { command as updateCustomers } from './update'
import { command as updateExternalCustomers } from './update_external'
import { command as members } from './members'

export const command = Command.make('customers').pipe(
  Command.withSubcommands([
    createCustomers,
    deleteCustomers,
    deleteExternalCustomers,
    getCustomers,
    getExternalCustomers,
    getStateCustomers,
    getStateExternalCustomers,
    listCustomers,
    listPaymentMethodsCustomers,
    listPaymentMethodsExternalCustomers,
    updateCustomers,
    updateExternalCustomers,
    members,
  ]),
)
