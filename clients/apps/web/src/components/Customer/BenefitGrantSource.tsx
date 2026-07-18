'use client'

import { schemas } from '@polar-sh/client'
import {
  Status,
  Text,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/orbit'
import Link from 'next/link'

export const BenefitGrantSource = ({
  grant,
  organization,
}: {
  grant: schemas['BenefitGrant']
  organization: schemas['Organization']
}) => {
  if (grant.standalone_grant_id) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <Status color="blue" status="Manual" />
        </TooltipTrigger>
        <TooltipContent>
          Granted manually, outside any subscription or purchase
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
