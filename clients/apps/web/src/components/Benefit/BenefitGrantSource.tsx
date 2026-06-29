import { schemas } from '@polar-sh/client'
import { Status } from '@polar-sh/orbit'
import Link from 'next/link'

interface BenefitGrantSourceProps {
  grant: schemas['BenefitGrant']
  organization: schemas['Organization']
}

export const BenefitGrantSource = ({
  grant,
  organization,
}: BenefitGrantSourceProps) => {
  if (grant.manual_grant_id) {
    return <Status color="blue" status="Manual" />
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

  return <Status status="Unknown" />
}
