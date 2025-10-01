import { schemas } from '@polar-sh/client'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import { twMerge } from 'tailwind-merge'

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

  const statusClassNames = {
    Revoked: 'bg-red-100 text-red-500 dark:bg-red-950',
    Granted: 'bg-emerald-200 text-emerald-500 dark:bg-emerald-950',
    Pending: 'bg-yellow-100 text-yellow-500 dark:bg-yellow-950',
    Error: 'bg-red-100 text-red-500 dark:bg-red-950',
  }

  return (
    <Tooltip>
      <TooltipTrigger>
        <Status
          className={twMerge('w-fit', statusClassNames[status])}
          status={status}
        />
      </TooltipTrigger>
      <TooltipContent>{statusDescription[status]}</TooltipContent>
    </Tooltip>
  )
}
