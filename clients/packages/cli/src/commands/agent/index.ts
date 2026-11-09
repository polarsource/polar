import { Command } from 'effect/cli'
import { setup } from '@/commands/agent/setup'

export const agent = Command.make('agent').pipe(
  Command.withDescription('Set up coding agents to build with Polar'),
  Command.withSubcommands([setup]),
)
