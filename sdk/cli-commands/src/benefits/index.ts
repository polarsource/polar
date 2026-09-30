// Generated CLI resource command. Do not edit.
import { Command } from 'effect/unstable/cli'
import { command as createBenefits } from './create'
import { command as deleteBenefits } from './delete'
import { command as filesBenefits } from './files'
import { command as getBenefits } from './get'
import { command as grantsBenefits } from './grants'
import { command as listBenefits } from './list'
import { command as updateBenefits } from './update'

export const command = Command.make('benefits').pipe(
  Command.withSubcommands([
    createBenefits,
    deleteBenefits,
    filesBenefits,
    getBenefits,
    grantsBenefits,
    listBenefits,
    updateBenefits,
  ]),
)
