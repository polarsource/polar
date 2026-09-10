// Generated customer command registry. Do not edit.
import { Command } from 'effect/unstable/cli'
import { command as createCustomers } from './customers/create'
import { command as deleteCustomers } from './customers/delete'
import { command as deleteExternalCustomers } from './customers/delete_external'
import { command as getCustomers } from './customers/get'
import { command as getExternalCustomers } from './customers/get_external'
import { command as getStateCustomers } from './customers/get_state'
import { command as getStateExternalCustomers } from './customers/get_state_external'
import { command as listCustomers } from './customers/list'
import { command as listPaymentMethodsCustomers } from './customers/list_payment_methods'
import { command as listPaymentMethodsExternalCustomers } from './customers/list_payment_methods_external'
import { command as updateCustomers } from './customers/update'
import { command as updateExternalCustomers } from './customers/update_external'

export const customers = Command.make('customers').pipe(
  Command.withDescription('Manage Polar customers'),
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
  ]),
)

export const commands = [customers]
export { ApiRuntime, ApiCommandError } from './runtime'
export type { ApiOperation, Environment } from './runtime'
