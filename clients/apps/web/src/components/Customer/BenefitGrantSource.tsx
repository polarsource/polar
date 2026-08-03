'use client'

import { schemas } from '@polar-sh/client'
import {
  Status,
  Text,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Link from 'next/link'

export const BenefitGrantSource = ({
  grant,
  organization,
}: {
  grant: schemas['BenefitGrant']
  organization: schemas['Organization']
}) => {
  if (grant.manual_grant) {
    const { reason, expires_at } = grant.manual_grant
    const status = <Status color="blue" status="Manual" />
    if (!reason && !expires_at) {
      return status
    }
    return (
      <Tooltip>
        <TooltipTrigger>{status}</TooltipTrigger>
        <TooltipContent>
          <Box flexDirection="column" rowGap="xs">
            {reason && (
              <Text variant="caption" color="inherit">
                Reason: {reason}
              </Text>
            )}
            {expires_at && (
              <Text variant="caption" color="inherit">
                Expires <FormattedDateTime datetime={expires_at} />
              </Text>
            )}
          </Box>
        </TooltipContent>
      </Tooltip>
    )
  }
  if (grant.subscription_id) {
    return (
      <Link
        href={`/dashboard/${organization.slug}/sales/subscriptions/${grant.subscription_id}`}
      >
        <Status color="gray" status="Subscription" />
      </Link>
    )
  }
  if (grant.order_id) {
    return (
      <Link href={`/dashboard/${organization.slug}/sales/${grant.order_id}`}>
        <Status color="gray" status="Order" />
      </Link>
    )
  }
  return <Text color="disabled">—</Text>
}
