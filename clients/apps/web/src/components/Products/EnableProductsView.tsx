'use client'

import { useUpdateOrganization } from '@/hooks/queries'
import { Bolt } from '@mui/icons-material'
import { Organization } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import { useState } from 'react'
import EmptyLayout from '../Layout/EmptyLayout'

export interface EnableSubscriptionsViewProps {
  organization: Organization
}

export const EnableProductsView = ({
  organization,
}: EnableSubscriptionsViewProps) => {
  const [enablingSubscriptions, setEnablingSubscriptions] = useState(false)
  const updateOrganization = useUpdateOrganization()
  const router = useRouter()

  const enableSubscriptions = async () => {
    setEnablingSubscriptions(true)

    await updateOrganization
      .mutateAsync({
        id: organization.id,
        body: {
          feature_settings: {
            subscriptions_enabled: true,
          },
        },
      })
      .then(() => {
        router.refresh()
      })
      .catch(() => {
        setEnablingSubscriptions(false)
      })
  }

  return (
    <EmptyLayout>
      <div className="dark:text-polar-500 flex flex-col items-center justify-center space-y-10 py-32 text-gray-500">
        <span className="text-6xl text-blue-400">
          <Bolt fontSize="inherit" />
        </span>
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-2xl font-medium text-gray-950 dark:text-white">
            Products & Subscriptions
          </h2>
          <h2 className="text-lg">
            Offer unique benefits to your supporters with Products &
            Subscriptions
          </h2>
        </div>
        <Button loading={enablingSubscriptions} onClick={enableSubscriptions}>
          Enable Products
        </Button>
      </div>
    </EmptyLayout>
  )
}
