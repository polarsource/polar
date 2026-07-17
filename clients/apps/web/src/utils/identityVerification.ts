import { schemas } from '@polar-sh/client'

export const isTerminalIdentityVerificationStatus = (
  status: schemas['IdentityVerificationStatus'] | null | undefined,
): boolean => status === 'verified' || status === 'failed'
