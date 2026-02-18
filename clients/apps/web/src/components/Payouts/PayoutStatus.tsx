import { schemas } from '@polar-sh/client'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

export const PayoutStatusDisplayTitle: Record<schemas['PayoutStatus'], string> =
  {
    succeeded: 'Succeeded',
    pending: 'Pending',
    failed: 'Failed',
    in_transit: 'In Transit',
  }

export const PayoutStatusDisplayColor: Record<schemas['PayoutStatus'], string> =
  {
    succeeded: 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950',
    pending: 'bg-yellow-100 text-yellow-500 dark:bg-yellow-950',
    failed: 'bg-red-100 text-red-500 dark:bg-red-950',
    in_transit: 'bg-blue-100 text-blue-500 dark:bg-blue-950',
  }

export const PayoutStatus = ({
  payout: { status, attempts },
}: {
  payout: schemas['Payout']
}) => {
  const lastAttempt = useMemo(() => attempts[attempts.length - 1], [attempts])

  if (status === 'failed') {
    return (
      <Tooltip>
        <TooltipTrigger className="cursor-help">
          <Status
            className={twMerge(PayoutStatusDisplayColor[status], 'w-fit')}
            status={PayoutStatusDisplayTitle[status]}
          />
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-64">
          <p className="text-justify text-sm">{lastAttempt.failed_reason}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Status
      className={twMerge(PayoutStatusDisplayColor[status], 'w-fit')}
      status={PayoutStatusDisplayTitle[status]}
    />
  )
}
