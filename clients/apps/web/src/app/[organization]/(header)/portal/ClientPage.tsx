'use client'

import { CustomerPortal } from '@/components/CustomerPortal/CustomerPortal'
import { useTrafficRecordPageView } from '@/utils/traffic'
import {
  ListResourceUserOrder,
  ListResourceUserSubscription,
  Organization,
} from '@polar-sh/sdk'

const ClientPage = ({
  organization,
  subscriptions,
  orders,
}: {
  organization: Organization
  subscriptions: ListResourceUserSubscription
  orders: ListResourceUserOrder
}) => {
  useTrafficRecordPageView({ organization })

  return (
    <CustomerPortal
      organization={organization}
      subscriptions={subscriptions.items ?? []}
      orders={orders.items ?? []}
    />
  )
}

export default ClientPage
