'use client'

import { MembersSection } from '@/components/Customer/CustomerPage/MembersSection'
import { useSubscriptions } from '@/hooks/queries'
import { useOrders } from '@/hooks/queries/orders'
import { schemas } from '@polar-sh/client'
import { isCustomerMembersEnabled } from './isCustomerMembersEnabled'

interface CustomerMembersProps {
  organization: schemas['Organization']
  customer: schemas['Customer']
}

export const CustomerMembers = ({
  organization,
  customer,
}: CustomerMembersProps) => {
  const isEnabled = isCustomerMembersEnabled(organization, customer)

  const { data: subscriptions } = useSubscriptions(
    isEnabled ? customer.organization_id : undefined,
    {
      customer_id: customer.id,
      limit: 999,
      sorting: ['-started_at'],
    },
  )

  const { data: orders } = useOrders(
    isEnabled ? customer.organization_id : undefined,
    {
      customer_id: customer.id,
      limit: 999,
      sorting: ['-created_at'],
    },
  )

  if (!isEnabled) {
    return null
  }

  return (
    <MembersSection
      customer={customer}
      organization={organization}
      subscriptions={subscriptions?.items}
      orders={orders?.items}
    />
  )
}
