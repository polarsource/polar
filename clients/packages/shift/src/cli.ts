import { Command } from '@effect/cli'
import { NodeContext, NodeRuntime } from '@effect/platform-node'
import { Effect } from 'effect'
import { buildCommand } from './commands/build.js'
import { validateCommand } from './commands/validate.js'

const rootCommand = Command.make('shift', {}, () => Effect.void).pipe(
  Command.withSubcommands([buildCommand, validateCommand]),
  Command.withDescription('Design token processing CLI'),
)

const cli = Command.run(rootCommand, {
  name: 'shift',
  version: '0.1.0',
})

cli(process.argv).pipe(
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain,
)
