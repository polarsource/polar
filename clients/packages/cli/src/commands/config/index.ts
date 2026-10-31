import { Command } from 'effect/cli'
import { apply } from '@/commands/config/apply'
import { init } from '@/commands/config/init'
import { plan } from '@/commands/config/plan'
import { prune } from '@/commands/config/prune'

export const config = Command.make('config').pipe(
  Command.withDescription('Manage your billing configuration'),
  Command.withSubcommands([init, plan, apply, prune]),
)
