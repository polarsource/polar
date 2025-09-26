'use client'

import { CustomerContextView } from '@/components/Customer/CustomerContextView'
import CustomFieldValue from '@/components/CustomFields/CustomFieldValue'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { ProductListItem } from '@/components/Products/ProductListItem'
import { DetailRow } from '@/components/Shared/DetailRow'
import CancelSubscriptionModal from '@/components/Subscriptions/CancelSubscriptionModal'
import SubscriptionDetails from '@/components/Subscriptions/SubscriptionDetails'
import UpdateSubscriptionModal from '@/components/Subscriptions/UpdateSubscriptionModal'
import { toast } from '@/components/Toast/use-toast'
import {
  useCustomFields,
  useProduct,
  useSubscription,
  useUncancelSubscription,
} from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { List } from '@polar-sh/ui/components/atoms/List'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
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
    hide: hideCancellationModal,
    show: showCancellationModal,
    isShown: isShownCancellationModal,
  } = useModal()
  const {
    hide: hideUpdateModal,
    show: showUpdateModal,
    isShown: isShownUpdateModal,
  } = useModal()

  const uncancelSubscription = useUncancelSubscription(_subscription.id)

  const handleUncancel = async () => {
    try {
      await uncancelSubscription.mutateAsync()
      toast({
        title: 'Subscription Uncanceled',
        description:
          'The subscription has been successfully uncanceled and will continue at the next billing cycle.',
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to uncancel the subscription. Please try again.',
        variant: 'error',
      })
    }
  }

  if (!subscription || !product) {
    return null
  }

  return (
    <DashboardBody
      title={
        <div className="flex flex-col gap-4">
          <div className="flex flex-row items-center gap-4">
            <h2 className="text-xl font-normal">Subscription</h2>
          </div>
        </div>
      }
      className="gap-y-8"
      header={
        <div className="flex flex-row gap-4">
          <Button type="button" onClick={showUpdateModal}>
            Update Subscription
          </Button>
          {subscription.cancel_at_period_end &&
          subscription.status !== 'canceled' ? (
            <Button
              type="button"
              variant="secondary"
              onClick={handleUncancel}
              loading={uncancelSubscription.isPending}
            >
              Uncancel
            </Button>
          ) : subscription.status !== 'canceled' ? (
            <Button
              type="button"
              variant="secondary"
              onClick={showCancellationModal}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      }
      contextViewClassName="bg-transparent dark:bg-transparent border-none rounded-none md:block hidden"
      contextView={
        <CustomerContextView
          organization={organization}
          customer={subscription.customer as schemas['Customer']}
        />
      }
    >
      <List size="small">
        <ProductListItem organization={organization} product={product} />
      </List>
      <ShadowBox className="dark:divide-polar-700 flex flex-col divide-y divide-gray-200 border-gray-200 bg-transparent p-0 md:!rounded-3xl">
        <div className="flex flex-col gap-6 p-8">
          <div className="flex flex-col gap-6">
            <SubscriptionDetails subscription={subscription} />
          </div>
        </div>

        {(customFields?.items?.length ?? 0) > 0 && (
          <div className="flex flex-col gap-6 p-8">
            <h3 className="text-lg">Custom Fields</h3>
            <div className="flex flex-col gap-2">
              {customFields?.items?.map((field) => (
                <DetailRow
                  key={field.id}
                  label={field.name}
                  value={
                    <CustomFieldValue
                      field={field}
                      value={
                        subscription.custom_field_data
                          ? subscription.custom_field_data[
                              field.slug as keyof typeof subscription.custom_field_data
                            ]
                          : undefined
                      }
                    />
                  }
                />
              ))}
            </div>
          </div>
        )}

        {Object.keys(subscription.metadata).length > 0 && (
          <div className="flex flex-col gap-6 p-8">
            <h3 className="text-lg">Metadata</h3>
            <div className="flex flex-col gap-2">
              {Object.entries(subscription.metadata).map(([key, value]) => (
                <DetailRow
                  key={key}
                  label={key}
                  value={value}
                  valueClassName="font-mono"
                />
              ))}
            </div>
          </div>
        )}
      </ShadowBox>

      <div className="flex flex-col gap-4 md:hidden">
        <CustomerContextView
          organization={organization}
          customer={subscription.customer as schemas['Customer']}
        />
      </div>

      <InlineModal
        isShown={isShownCancellationModal}
        hide={hideCancellationModal}
        modalContent={
          <CancelSubscriptionModal
            subscription={subscription}
            onCancellation={hideCancellationModal}
          />
        }
      />
      <InlineModal
        isShown={isShownUpdateModal}
        hide={hideUpdateModal}
        modalContent={
          <UpdateSubscriptionModal
            subscription={subscription}
            onUpdate={hideUpdateModal}
          />
        }
      />
    </DashboardBody>
  )
}

export default ClientPage
