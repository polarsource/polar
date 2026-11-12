import { Argument, Flag } from 'effect/cli'
import { DEFAULT_CONFIG_FILES } from '@/schemas/BillingConfig'

export const sandbox = Flag.Boolean('sandbox').pipe(
  Flag.withDefault(false),
  Flag.withDescription('Use the sandbox environment'),
)
export const production = Flag.Boolean('production').pipe(
  Flag.withDefault(false),
  Flag.withDescription('Use the production environment'),
)
export const local = Flag.Boolean('local').pipe(
  Flag.withDefault(false),
  Flag.withDescription('Use a local Polar stack on 127.0.0.1'),
  Flag.withHidden,
)
export const confirm = Flag.Boolean('confirm').pipe(
  Flag.withAlias('c'),
  Flag.withDefault(false),
  Flag.withDescription('Skip the confirmation prompt'),
)
export const org = Flag.String('org').pipe(
  Flag.optional,
  Flag.withDescription('Organization ID or slug for this invocation only'),
)
export const configFile = Argument.String('file').pipe(
  Argument.withDescription(
    `Path to the billing config file. Defaults to the first of ${DEFAULT_CONFIG_FILES.join(', ')} found in the current directory`,
  ),
  Argument.optional,
)
