'use client'

import { Client, schemas } from '@polar-sh/client'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import { BenefitGrant } from '../Benefit/BenefitGrant'
import { groupBenefitGrants } from './groupBenefitGrants'

export interface CustomerPortalGrantsGroupedProps {
  benefitGrants: schemas['CustomerBenefitGrant'][]
  api: Client
}

const GrantList = ({
  grants,
  api,
}: {
  grants: schemas['CustomerBenefitGrant'][]
  api: Client
}) => (
  <List>
    {grants.map((benefitGrant) => (
      <ListItem
        key={benefitGrant.id}
        className="py-6 hover:bg-transparent dark:hover:bg-transparent"
      >
        <BenefitGrant api={api} benefitGrant={benefitGrant} />
      </ListItem>
    ))}
  </List>
)

export const CustomerPortalGrantsGrouped = ({
  api,
  benefitGrants,
}: CustomerPortalGrantsGroupedProps) => {
  const { shared, bySubscription } = groupBenefitGrants(benefitGrants)

  return (
    <div className="flex w-full flex-col gap-4">
      <h3 className="text-xl">Benefit Grants</h3>
      <div className="flex flex-col gap-6">
        {shared.length > 0 && <GrantList grants={shared} api={api} />}
        {bySubscription.map(({ subscription, grants }) => (
          <div key={subscription.id} className="flex flex-col gap-3">
            <h4 className="dark:text-polar-500 text-sm text-gray-500">
              Subscription to {subscription.product_name}
            </h4>
            <GrantList grants={grants} api={api} />
          </div>
        ))}
      </div>
    </div>
  )
}
