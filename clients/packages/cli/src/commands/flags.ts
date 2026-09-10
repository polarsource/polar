import { Flag } from 'effect/unstable/cli'

export const sandbox = Flag.boolean('sandbox').pipe(
  Flag.withDefault(false),
  Flag.withDescription('Use the sandbox environment'),
)
export const production = Flag.boolean('production').pipe(
  Flag.withDefault(false),
  Flag.withDescription('Use the production environment'),
)
export const org = Flag.string('org').pipe(
  Flag.optional,
  Flag.withDescription('Organization ID for this invocation only'),
)
