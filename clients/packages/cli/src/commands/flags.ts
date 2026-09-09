import { Flag } from 'effect/unstable/cli'
import type { PolarEnvironment } from '../schemas/Auth'

export const production = Flag.boolean('production').pipe(
  Flag.withDefault(false),
  Flag.withDescription('Use production instead of sandbox'),
)
export const org = Flag.string('org').pipe(
  Flag.optional,
  Flag.withDescription('Organization ID for this invocation only'),
)
export const environmentOf = (production: boolean): PolarEnvironment =>
  production ? 'production' : 'sandbox'
