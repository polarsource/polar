import { Command } from 'effect/unstable/cli'
import { apply } from '@/commands/config/apply'

export const config = Command.make('config').pipe(
  Command.withDescription('Manage your billing configuration'),
  Command.withSubcommands([apply]),
)
