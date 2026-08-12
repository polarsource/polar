'use client'

import { MembersSection } from '@/components/Customer/CustomerPage/MembersSection'
import { useSubscriptions } from '@/hooks/queries'
import { useOrders } from '@/hooks/queries/orders'
import { schemas } from '@polar-sh/client'

interface CustomerMembersProps {
  organization: schemas['Organization']
  customer: schemas['Customer']
}

export const CustomerMembers = ({
  organization,
  customer,
}: CustomerMembersProps) => {
  const { data: subscriptions } = useSubscriptions(customer.organization_id, {
    customer_id: customer.id,
    limit: 999,
    sorting: ['-started_at'],
  })

  const { data: orders } = useOrders(customer.organization_id, {
    customer_id: customer.id,
    limit: 999,
    sorting: ['-created_at'],
  })

  return (
    <MembersSection
      customer={customer}
      organization={organization}
      subscriptions={subscriptions?.items}
      orders={orders?.items}
    />
  )
}
