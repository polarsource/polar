'use client'

import revalidate from '@/app/actions'
import { useCustomerOrders } from '@/hooks/queries/customerPortal'
import { canRetryOrderPayment } from '@/utils/order'
import { Client, schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { getThemePreset } from '@polar-sh/ui/hooks/theming'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { OrderPaymentRetryModal } from './OrderPaymentRetryModal'

export const SubscriptionRetryPaymentButton = ({
  api,
  subscription,
}: {
  api: Client
  subscription: schemas['CustomerSubscription']
}) => {
  const router = useRouter()
  const theme = useTheme()
  const themingPreset = getThemePreset(theme.resolvedTheme as 'light' | 'dark')
  const [isOpen, setIsOpen] = useState(false)

  const { data: orders } = useCustomerOrders(api, {
    subscription_id: subscription.id,
    limit: 10,
    sorting: ['-created_at'],
  })
  const retryableOrder = orders?.items.find(canRetryOrderPayment)

  if (!retryableOrder) {
    return null
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Retry payment</Button>
      <OrderPaymentRetryModal
        order={retryableOrder}
        api={api}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSuccess={async () => {
          setIsOpen(false)
          await revalidate(`customer_portal`)
          router.refresh()
        }}
        themingPreset={themingPreset}
      />
    </>
  )
}
