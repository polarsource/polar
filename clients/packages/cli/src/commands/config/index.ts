import { Command } from 'effect/cli'
import { disable } from '@/commands/config/disable'
import { draft } from '@/commands/config/draft'
import { generate } from '@/commands/config/generate'
import { init } from '@/commands/config/init'
import { prune } from '@/commands/config/prune'
import { publish } from '@/commands/config/publish'
import { validate } from '@/commands/config/validate'

export const config = Command.make('config').pipe(
  Command.withDescription('Manage your billing configuration'),
  Command.withSubcommands([
    init,
    validate,
    draft,
    publish,
    generate,
    prune,
    disable,
  ]),
)
