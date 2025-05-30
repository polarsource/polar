'use client'

import CustomerPortalOrder from '@/components/CustomerPortal/CustomerPortalOrder'
import { createClientSideAPI } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import { useThemePreset } from '@polar-sh/ui/hooks/theming'

const ClientPage = ({
  organization,
  order,
  customerSessionToken,
}: {
  organization: schemas['Organization']
  order: schemas['CustomerOrder']
  customerSessionToken: string
}) => {
  const themingPreset = useThemePreset(
    organization.slug === 'midday' ? 'midday' : 'polar',
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
