// Generated CLI resource command. Do not edit.
import { Command } from 'effect/cli'
import { command as listBenefitGrants } from './list'

export const command = Command.make('benefit_grants').pipe(
  Command.withSubcommands([listBenefitGrants]),
)
