'use client'

import { CustomerContextView } from '@/components/Customer/CustomerContextView'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useModal } from '@/components/Modal/useModal'
import { SubscriptionSeatsSection } from '@/components/Seats/SubscriptionSeatsSection'
import SubscriptionActionsMenu from '@/components/Subscriptions/SubscriptionActionsMenu'
import { SubscriptionDetailsGrid } from '@/components/Subscriptions/SubscriptionDetailsGrid'
import SubscriptionUsageChargePreview from '@/components/Subscriptions/SubscriptionUsageChargePreview'
import { SubscriptionAttention } from '@/components/Subscriptions/SubscriptionAttention'
import { SubscriptionBenefitGrants } from '@/components/Subscriptions/SubscriptionBenefitGrants'
import { SubscriptionBillingHistory } from '@/components/Subscriptions/SubscriptionBillingHistory'
import { SubscriptionSidePanel } from '@/components/Subscriptions/SubscriptionSidePanel'
import { SubscriptionSecondaryDetails } from '@/components/Subscriptions/SubscriptionSecondaryDetails'
import UpdateSubscriptionModal from '@/components/Subscriptions/UpdateSubscriptionModal'
import { useProduct, useSubscription } from '@/hooks/queries'
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
      detailView={
        <SubscriptionSidePanel
          organization={organization}
          subscription={subscription}
        />
      }
    >
      <SubscriptionAttention subscription={subscription} />

      <SubscriptionDetailsGrid
        subscription={subscription}
        product={product}
        organization={organization}
      />

      <SubscriptionUsageChargePreview subscription={subscription} />

      <SubscriptionBillingHistory
        organization={organization}
        subscription={subscription}
      />

      <SubscriptionBenefitGrants
        organization={organization}
        subscription={subscription}
      />

      <SubscriptionSecondaryDetails
        subscription={subscription}
        customFields={product?.attached_custom_fields.map(
          ({ custom_field }) => custom_field,
        )}
      />

      <SubscriptionSeatsSection subscription={subscription} />

      <Box
        flexDirection="column"
        rowGap="l"
        display={{ base: 'flex', lg: 'none' }}
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
