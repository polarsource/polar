'use client'

import CustomerPortalOrder from '@/components/CustomerPortal/CustomerPortalOrder'
import { createClientSideAPI } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import { getThemePreset } from '@polar-sh/ui/hooks/theming'
import { useTheme } from 'next-themes'

const ClientPage = ({
  organization,
  order,
  customerSessionToken,
}: {
  organization: schemas['CustomerOrganization']
  order: schemas['CustomerOrder']
  customerSessionToken: string
}) => {
  const theme = useTheme()
  const themingPreset = getThemePreset(
    organization.slug,
    theme.resolvedTheme as 'light' | 'dark',
  )
  const api = createClientSideAPI(customerSessionToken)

  return (
    <CustomerPortalOrder
      api={api}
      order={order}
      customerSessionToken={customerSessionToken}
      themingPreset={themingPreset}
    />
  )
}

export default ClientPage
