import { Command } from 'effect/unstable/cli'
import { validate } from '@/commands/config/validate'

export const config = Command.make('config').pipe(
  Command.withDescription('Manage your billing configuration'),
  Command.withSubcommands([validate]),
)
