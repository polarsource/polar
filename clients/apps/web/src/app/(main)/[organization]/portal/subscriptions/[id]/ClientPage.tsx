'use client'

import CustomerPortalSubscription from '@/components/CustomerPortal/CustomerPortalSubscription'
import { createClientSideAPI } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import { getThemePreset } from '@polar-sh/ui/hooks/theming'
import { useTheme } from 'next-themes'

const ClientPage = ({
  subscription,
  customerSessionToken,
}: {
  subscription: schemas['CustomerSubscription']
  customerSessionToken: string
}) => {
  const theme = useTheme()
  const themingPreset = getThemePreset(
    subscription.product.organization.slug,
    theme.resolvedTheme as 'light' | 'dark',
  )

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
