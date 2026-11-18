import {
  Status,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/orbit'

const WILDCARD_PREFIX = '*.'

const StatusWithTooltip = ({
  status,
  color,
  tooltip,
}: {
  status: string
  color: 'yellow' | 'gray'
  tooltip: string
}) => (
  <Tooltip delayDuration={150}>
    <TooltipTrigger asChild>
      <span>
        <Status size="small" color={color} status={status} />
      </span>
    </TooltipTrigger>
    <TooltipContent>{tooltip}</TooltipContent>
  </Tooltip>
)

export const EmbedHostWalletStatus = ({
  host,
  hasWalletPayments,
  hasPendingWalletPayments,
}: {
  host: string
  hasWalletPayments: boolean
  hasPendingWalletPayments: boolean
}) => {
  if (hasWalletPayments) {
    return <Status size="small" color="green" status="Wallet payments" />
  }

  if (hasPendingWalletPayments) {
    return (
      <StatusWithTooltip
        color="yellow"
        status="Wallet payments pending"
        tooltip="Apple Pay and Google Pay turn on once your organization can accept payments."
      />
    )
  }

  if (host.startsWith(WILDCARD_PREFIX)) {
    return (
      <StatusWithTooltip
        color="gray"
        status="Wallet payments not supported"
        tooltip={`Apple Pay and Google Pay need each subdomain on its own, like shop.${host.slice(WILDCARD_PREFIX.length)}.`}
      />
    )
  }

  if (host.includes('://')) {
    return null
  }

  return (
    <StatusWithTooltip
      color="gray"
      status="Wallet payments need a verified domain"
      tooltip="Verify the domain this host belongs to under Domains to turn on Apple Pay and Google Pay."
    />
  )
}
