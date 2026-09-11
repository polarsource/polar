// Generated CLI resource command. Do not edit.
import { Command } from 'effect/unstable/cli'
import { command as getLicenseKeys } from './get'
import { command as getActivationLicenseKeys } from './get_activation'
import { command as listLicenseKeys } from './list'
import { command as rotateLicenseKeys } from './rotate'
import { command as updateLicenseKeys } from './update'

export const command = Command.make('license_keys').pipe(
  Command.withSubcommands([
    getLicenseKeys,
    getActivationLicenseKeys,
    listLicenseKeys,
    rotateLicenseKeys,
    updateLicenseKeys,
  ]),
)
