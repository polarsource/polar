import { Command } from 'effect/cli'
import { listen } from '@/commands/webhook/listen'
import { secret } from '@/commands/webhook/secret'
import { trigger } from '@/commands/webhook/trigger'

export const webhook = Command.make('webhook').pipe(
  Command.withDescription(
    'Test webhooks against your local server and get signing secrets',
  ),
  Command.withSubcommands([listen, trigger, secret]),
)
