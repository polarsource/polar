import { Command } from 'effect/cli'
import { apply } from '@/commands/config/apply'
import { plan } from '@/commands/config/plan'
import { pull } from '@/commands/config/pull'

export const config = Command.make('config').pipe(
  Command.withDescription('Manage your billing configuration'),
  Command.withSubcommands([pull, plan, apply]),
)
