import { schemas } from '@polar-sh/client'
import {
  StatusLabel,
  type StatusIconProps,
} from '@/components/Shared/StatusIcon'
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
    'Manually revoked': 'This grant was manually revoked',
    Pending: 'The benefit grant is currently being processed',
    Error: grant.error?.message ?? 'An unknown error occurred',
  }

  const statusIcons: Record<typeof status, StatusIconProps> = {
    Revoked: { shape: 'cross', tone: 'red' },
    Granted: { shape: 'check', tone: 'green' },
    'Manually granted': { shape: 'check', tone: 'green' },
    'Manually revoked': { shape: 'cross', tone: 'red' },
    Pending: { shape: 'half', tone: 'yellow' },
    Error: { shape: 'alert', tone: 'red' },
  }

  return (
    <Tooltip>
      <TooltipTrigger>
        <StatusLabel {...statusIcons[status]} label={status} />
      </TooltipTrigger>
      <TooltipContent>{statusDescription[status]}</TooltipContent>
    </Tooltip>
  )
}
