import { schemas } from '@polar-sh/client'
import { Status, type StatusColor } from '@polar-sh/orbit'
import { Tooltip, TooltipContent, TooltipTrigger } from '@polar-sh/orbit'

interface BenefitGrantStatusProps {
  grant: schemas['BenefitGrant']
}

export const BenefitGrantStatus = ({ grant }: BenefitGrantStatusProps) => {
  const isRevoked = grant.revoked_at !== null
  const isGranted = grant.is_granted
  const hasError = grant.error !== null

  const status = hasError
    ? 'Error'
    : isRevoked
      ? 'Revoked'
      : isGranted
        ? 'Granted'
        : 'Pending'

  const statusDescription = {
    Revoked: 'The customer does not have access to this benefit',
    Granted: 'The customer has access to this benefit',
    Pending: 'The benefit grant is currently being processed',
    Error: grant.error?.message ?? 'An unknown error occurred',
  }

  const statusColors: Record<typeof status, StatusColor> = {
    Revoked: 'red',
    Granted: 'green',
    Pending: 'yellow',
    Error: 'red',
  }

  return (
    <Tooltip>
      <TooltipTrigger>
        <Status color={statusColors[status]} status={status} />
      </TooltipTrigger>
      <TooltipContent>{statusDescription[status]}</TooltipContent>
    </Tooltip>
  )
}
