'use client'

import CustomerPortalSubscription from '@/components/CustomerPortal/CustomerPortalSubscription'
import { createClientSideAPI } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import { useThemePreset } from '@polar-sh/ui/hooks/theming'

const ClientPage = ({
  subscription,
  customerSessionToken,
}: {
  subscription: schemas['CustomerSubscription']
  customerSessionToken?: string
}) => {
  const themingPreset = useThemePreset(
    subscription.product.organization.slug === 'midday' ? 'midday' : 'polar',
  )

  const api = createClientSideAPI(customerSessionToken)
  return (
    <CustomerPortalSubscription
      api={api}
      subscription={subscription}
      themingPreset={themingPreset}
    />
  )
}

export default ClientPage
