import { schemas } from '@polar-sh/client'
import { Status, type StatusColor } from '@polar-sh/orbit'
import { Tooltip, TooltipContent, TooltipTrigger } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check, Clock, X } from '@polar-sh/orbit/icons'

const PayoutStatusDisplayTitle: Record<schemas['PayoutStatus'], string> = {
  succeeded: 'Succeeded',
  pending: 'Pending',
  held: 'Held for review',
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
        <p className="text-left text-sm">{tooltipMessage}</p>
      </TooltipContent>
    </Tooltip>
  )
}

const PayoutStatusIconDisplay: Record<
  schemas['PayoutStatus'],
  {
    Icon: typeof Check
    color: 'text-success' | 'text-warning' | 'text-danger' | 'text-tertiary'
    background:
      | 'background-success'
      | 'background-warning'
      | 'background-danger'
      | 'background-card'
  }
> = {
  succeeded: {
    Icon: Check,
    color: 'text-success',
    background: 'background-success',
  },
  pending: {
    Icon: Clock,
    color: 'text-warning',
    background: 'background-warning',
  },
  in_transit: {
    Icon: Clock,
    color: 'text-warning',
    background: 'background-warning',
  },
  held: {
    Icon: Clock,
    color: 'text-warning',
    background: 'background-warning',
  },
  failed: { Icon: X, color: 'text-danger', background: 'background-danger' },
  canceled: { Icon: X, color: 'text-tertiary', background: 'background-card' },
}

export const PayoutStatusIcon = ({
  payout: { status, attempts },
}: {
  payout: schemas['Payout']
}) => {
  const { Icon, color, background } = PayoutStatusIconDisplay[status]
  const detail =
    status === 'failed'
      ? attempts.at(-1)?.failed_reason
      : PayoutStatusTooltip[status]

  return (
    <Tooltip>
      <TooltipTrigger
        className="cursor-default"
        aria-label={PayoutStatusDisplayTitle[status]}
      >
        <Box
          width={16}
          height={16}
          alignItems="center"
          justifyContent="center"
          borderRadius="full"
          backgroundColor={background}
          color={color}
        >
          <Icon className="h-2 w-2" strokeWidth={3.5} />
        </Box>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        <p className="text-left text-sm">
          {PayoutStatusDisplayTitle[status]}
          {detail ? `. ${detail}` : ''}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
