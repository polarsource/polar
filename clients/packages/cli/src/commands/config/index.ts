import { Command } from 'effect/cli'
import { apply } from '@/commands/config/apply'
import { disable } from '@/commands/config/disable'
import { init } from '@/commands/config/init'
import { plan } from '@/commands/config/plan'
import { prune } from '@/commands/config/prune'
import { publish } from '@/commands/config/publish'

export const config = Command.make('config').pipe(
  Command.withDescription('Manage your billing configuration'),
  Command.withSubcommands([init, plan, apply, publish, prune, disable]),
)
