import { Command } from 'effect/cli'
import { listen } from '@/commands/webhook/listen'
import { trigger } from '@/commands/webhook/trigger'

export const webhook = Command.make('webhook').pipe(
  Command.withDescription('Test webhooks against your local server'),
  Command.withSubcommands([listen, trigger]),
)
