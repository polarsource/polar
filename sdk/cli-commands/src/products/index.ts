// Generated CLI resource command. Do not edit.
import { Command } from 'effect/unstable/cli'
import { command as createProducts } from './create'
import { command as getProducts } from './get'
import { command as listProducts } from './list'
import { command as updateProducts } from './update'
import { command as updateBenefitsProducts } from './update_benefits'

export const command = Command.make('products').pipe(
  Command.withSubcommands([
    createProducts,
    getProducts,
    listProducts,
    updateProducts,
    updateBenefitsProducts,
  ]),
)
