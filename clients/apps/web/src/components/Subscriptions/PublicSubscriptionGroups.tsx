import { CardContent } from '@mui/material'
import { SubscriptionGroup } from '@polar-sh/sdk'
import Link from 'next/link'
import { Card, CardHeader, CardTitle } from 'polarkit/components/ui/card'
import { getCentsInDollarString } from 'polarkit/money'
import { useMemo } from 'react'

interface PublicSubscriptionGroupProps {
  subscriptionGroup: SubscriptionGroup
  subscribePath: string
}

const PublicSubscriptionGroup: React.FC<PublicSubscriptionGroupProps> = ({
  subscriptionGroup,
  subscribePath,
}) => {
  const firstTier = useMemo(
    () => subscriptionGroup.tiers[0],
    [subscriptionGroup],
  )

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{subscriptionGroup.name}</CardTitle>
        <div>
          {subscriptionGroup.tiers.length > 1 ? 'from' : ''}{' '}
          <span className="text-5xl text-blue-600">
            ${getCentsInDollarString(firstTier.price_amount, false, true)}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {subscriptionGroup.tiers.map((tier) => (
          <>
            <Link
              href={{ pathname: subscribePath, query: { tier: tier.id } }}
              className="flex justify-between"
            >
              <h3 className="text-lg font-semibold">{tier.name}</h3>
              <div className="text-lg font-semibold text-blue-600">
                ${getCentsInDollarString(tier.price_amount, false, true)}
              </div>
            </Link>
          </>
        ))}
      </CardContent>
    </Card>
  )
}
interface PublicSubscriptionGroupsProps {
  subscriptionGroups: SubscriptionGroup[]
  subscribePath: string
}

const PublicSubscriptionGroups: React.FC<PublicSubscriptionGroupsProps> = ({
  subscriptionGroups,
  subscribePath,
}) => {
  return (
    <div className="flex flex-row gap-4">
      {subscriptionGroups
        .filter(({ tiers }) => tiers.length > 0)
        .map((subscriptionGroup) => (
          <PublicSubscriptionGroup
            key={subscriptionGroup.id}
            subscriptionGroup={subscriptionGroup}
            subscribePath={subscribePath}
          />
        ))}
    </div>
  )
}

export default PublicSubscriptionGroups
