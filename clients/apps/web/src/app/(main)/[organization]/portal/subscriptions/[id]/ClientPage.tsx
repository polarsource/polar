'use client'

import CustomerPortalSubscription from '@/components/CustomerPortal/CustomerPortalSubscription'
import { createClientSideAPI } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import { getThemePreset } from '@polar-sh/ui/hooks/theming'

const ClientPage = ({
  subscription,
  customerSessionToken,
}: {
  subscription: schemas['CustomerSubscription']
  customerSessionToken: string
}) => {
  const themingPreset = getThemePreset(subscription.product.organization.slug)

  const api = createClientSideAPI(customerSessionToken)
  return (
    <CustomerPortalSubscription
      api={api}
      customerSessionToken={customerSessionToken}
      subscription={subscription}
      themingPreset={themingPreset}
    />
  )
}

export default ClientPage
