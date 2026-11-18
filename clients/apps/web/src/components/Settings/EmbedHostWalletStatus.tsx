import {
  Status,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/orbit'

const WILDCARD_PREFIX = '*.'

export const EmbedHostWalletStatus = ({
  host,
  hasWalletPayments,
}: {
  host: string
  hasWalletPayments: boolean
}) => {
  if (hasWalletPayments) {
    return <Status size="small" color="green" status="Wallet payments" />
  }

  if (!host.startsWith(WILDCARD_PREFIX)) {
    return null
  }

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <span>
          <Status
            size="small"
            color="gray"
            status="Wallet payments not supported"
          />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {`Apple Pay and Google Pay need each subdomain on its own, like shop.${host.slice(WILDCARD_PREFIX.length)}.`}
      </TooltipContent>
    </Tooltip>
  )
}
