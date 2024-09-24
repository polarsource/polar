'use client'

import { CustomerPortal } from '@/components/CustomerPortal/CustomerPortal'
import { useTrafficRecordPageView } from '@/utils/traffic'
import { ListResourceUserSubscription, Organization } from '@polar-sh/sdk'

const ClientPage = ({
  organization,
  subscriptions,
}: {
  organization: Organization
  subscriptions: ListResourceUserSubscription
}) => {
  useTrafficRecordPageView({ organization })

  return (
    <CustomerPortal
      organization={organization}
      subscriptions={subscriptions.items ?? []}
      orders={[]}
    />
  )
}

export default ClientPage
