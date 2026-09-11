// Generated CLI resource command. Do not edit.
import { Command } from 'effect/unstable/cli'
import { command as generateInvoiceOrders } from './generate_invoice'
import { command as getOrders } from './get'
import { command as invoiceOrders } from './invoice'
import { command as listOrders } from './list'
import { command as receiptOrders } from './receipt'
import { command as updateOrders } from './update'

export const command = Command.make('orders').pipe(
  Command.withSubcommands([
    generateInvoiceOrders,
    getOrders,
    invoiceOrders,
    listOrders,
    receiptOrders,
    updateOrders,
  ]),
)
