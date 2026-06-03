import { schemas } from '@polar-sh/client'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import { twMerge } from 'tailwind-merge'

const PayoutStatusDisplayTitle: Record<schemas['PayoutStatus'], string> = {
  succeeded: 'Succeeded',
  pending: 'Pending',
  held: 'Held',
  failed: 'Failed',
  in_transit: 'In Transit',
  canceled: 'Canceled',
}

const PayoutStatusDisplayColor: Record<schemas['PayoutStatus'], string> = {
  succeeded: 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950',
  pending: 'bg-yellow-100 text-yellow-500 dark:bg-yellow-950',
  held: 'bg-yellow-100 text-yellow-500 dark:bg-yellow-950',
  failed: 'bg-red-100 text-red-500 dark:bg-red-950',
  in_transit: 'bg-blue-100 text-blue-500 dark:bg-blue-950',
  canceled: 'bg-gray-100 text-gray-600 dark:bg-polar-700 dark:text-polar-400',
}

const PayoutStatusTooltip: Partial<Record<schemas['PayoutStatus'], string>> = {
  held: 'This payout is on hold while your account is under review. It will be paid out automatically once the review is complete.',
}

export const PayoutStatus = ({
  payout: { status, attempts },
}: {
  payout: schemas['Payout']
}) => {
  const tooltipMessage =
    status === 'failed'
      ? attempts.at(-1)?.failed_reason
      : PayoutStatusTooltip[status]

  const badge = (
    <Status
      className={twMerge(PayoutStatusDisplayColor[status], 'w-fit')}
      status={PayoutStatusDisplayTitle[status]}
    />
  )

  if (!tooltipMessage) {
    return badge
  }

  return (
    <Tooltip>
      <TooltipTrigger className="cursor-help">{badge}</TooltipTrigger>
      <TooltipContent side="right" className="max-w-64">
        <p className="text-justify text-sm">{tooltipMessage}</p>
      </TooltipContent>
    </Tooltip>
  )
}
