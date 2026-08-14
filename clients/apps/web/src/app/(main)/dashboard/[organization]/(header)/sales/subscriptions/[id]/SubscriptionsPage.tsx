'use client'

import { CustomerContextView } from '@/components/Customer/CustomerContextView'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useModal } from '@/components/Modal/useModal'
import { SubscriptionSeatsSection } from '@/components/Seats/SubscriptionSeatsSection'
import SubscriptionActionsMenu from '@/components/Subscriptions/SubscriptionActionsMenu'
import { SubscriptionDetailsGrid } from '@/components/Subscriptions/SubscriptionDetailsGrid'
import SubscriptionInvoicePreview from '@/components/Subscriptions/SubscriptionInvoicePreview'
import SubscriptionOrdersSection from '@/components/Subscriptions/SubscriptionOrdersSection'
import { SubscriptionSecondaryDetails } from '@/components/Subscriptions/SubscriptionSecondaryDetails'
import UpdateSubscriptionModal from '@/components/Subscriptions/UpdateSubscriptionModal'
import { useCustomFields, useProduct, useSubscription } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { Button, InlineModal, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import React from 'react'

interface ClientPageProps {
  organization: schemas['Organization']
  subscription: schemas['Subscription']
}

const ClientPage: React.FC<ClientPageProps> = ({
  organization,
  subscription: _subscription,
}) => {
  const { data: subscription } = useSubscription(
    _subscription.id,
    _subscription,
  )
  const { data: customFields } = useCustomFields(organization.id)
  const { data: product } = useProduct(_subscription.product.id)
  const {
    hide: hideUpdateModal,
    show: showUpdateModal,
    isShown: isShownUpdateModal,
  } = useModal()

  if (!subscription || !product) {
    return null
  }

  return (
    <DashboardBody
      title={
        <Box alignItems="center" columnGap="l">
          <Text variant="heading-xs" as="h2">
            Subscription
          </Text>
        </Box>
      }
      className="gap-y-16"
      header={
        <Box alignItems="center" columnGap="l">
          <Button type="button" onClick={showUpdateModal}>
            Update Subscription
          </Button>
          <SubscriptionActionsMenu subscription={subscription} />
        </Box>
      }
      contextViewClassName="bg-transparent dark:bg-transparent border-none rounded-none"
      contextViewTitle="Customer"
      contextView={
        <CustomerContextView
          organization={organization}
          customer={subscription.customer}
        />
      }
    >
      <SubscriptionDetailsGrid
        subscription={subscription}
        product={product}
        organization={organization}
      />

      <SubscriptionInvoicePreview subscription={subscription} />

      <SubscriptionSecondaryDetails
        subscription={subscription}
        customFields={customFields?.items}
      />

      <SubscriptionSeatsSection subscription={subscription} />

      <SubscriptionOrdersSection
        organization={organization}
        subscription={subscription}
      />

      <Box
        flexDirection="column"
        rowGap="l"
        display={{ base: 'flex', md: 'none' }}
      >
        <Text variant="heading-xs" as="h3">
          Customer
        </Text>
        <CustomerContextView
          organization={organization}
          customer={subscription.customer}
        />
      </Box>

      <InlineModal
        isShown={isShownUpdateModal}
        hide={hideUpdateModal}
        modalContent={
          <UpdateSubscriptionModal
            subscription={subscription}
            onUpdate={hideUpdateModal}
            organization={organization}
            hide={hideUpdateModal}
          />
        }
      />
    </DashboardBody>
  )
}

export default ClientPage
