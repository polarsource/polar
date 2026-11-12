import { schemas } from '@polar-sh/client'
import { Status, type StatusColor } from '@polar-sh/orbit'
import { Tooltip, TooltipContent, TooltipTrigger } from '@polar-sh/orbit'

interface BenefitGrantStatusProps {
  grant: schemas['BenefitGrant']
}

export const BenefitGrantStatus = ({ grant }: BenefitGrantStatusProps) => {
  const status = grant.manually_revoked_at
    ? 'Manually revoked'
    : grant.error
      ? 'Error'
      : grant.is_revoked
        ? 'Revoked'
        : grant.is_granted
          ? grant.manually_granted_at
            ? 'Manually granted'
            : 'Granted'
          : 'Pending'

  const statusDescription = {
    Revoked: 'The customer does not have access to this benefit',
    Granted: 'The customer has access to this benefit',
    'Manually granted': 'This benefit was granted manually',
    'Manually revoked': 'This grant was permanently revoked manually',
    Pending: 'The benefit grant is currently being processed',
    Error: grant.error?.message ?? 'An unknown error occurred',
  }

  const statusColors: Record<typeof status, StatusColor> = {
    Revoked: 'red',
    Granted: 'green',
    'Manually granted': 'green',
    'Manually revoked': 'red',
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
