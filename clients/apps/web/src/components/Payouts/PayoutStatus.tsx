import { schemas } from '@polar-sh/client'
import { Status, type StatusColor } from '@polar-sh/orbit'
import { Tooltip, TooltipContent, TooltipTrigger } from '@polar-sh/orbit'

const PayoutStatusDisplayTitle: Record<schemas['PayoutStatus'], string> = {
  succeeded: 'Succeeded',
  pending: 'Pending',
  held: 'Held',
  failed: 'Failed',
  in_transit: 'In Transit',
  canceled: 'Canceled',
}

const PayoutStatusDisplayColor: Record<schemas['PayoutStatus'], StatusColor> = {
  succeeded: 'green',
  pending: 'yellow',
  held: 'yellow',
  failed: 'red',
  in_transit: 'blue',
  canceled: 'gray',
}

const PayoutStatusTooltip: Partial<Record<schemas['PayoutStatus'], string>> = {
  held: 'This payout is on hold while your account is under review. It will be paid out automatically once the review is complete.',
}

export const PayoutStatus = ({
  payout: { status, attempts },
  size = 'medium',
}: {
  payout: schemas['Payout']
  size?: 'small' | 'medium'
}) => {
  const tooltipMessage =
    status === 'failed'
      ? attempts.at(-1)?.failed_reason
      : PayoutStatusTooltip[status]

  const badge = (
    <Status
      color={PayoutStatusDisplayColor[status]}
      status={PayoutStatusDisplayTitle[status]}
      size={size}
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
