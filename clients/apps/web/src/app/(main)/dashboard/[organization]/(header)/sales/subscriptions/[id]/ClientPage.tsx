'use client'

import { CustomerContextView } from '@/components/Customer/CustomerContextView'
import CustomFieldValue from '@/components/CustomFields/CustomFieldValue'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { ProductThumbnail } from '@/components/Products/ProductThumbnail'
import CancelSubscriptionModal from '@/components/Subscriptions/CancelSubscriptionModal'
import SubscriptionDetails from '@/components/Subscriptions/SubscriptionDetails'
import UpdateSubscriptionModal from '@/components/Subscriptions/UpdateSubscriptionModal'
import { useCustomFields, useProduct, useSubscription } from '@/hooks/queries'
import { markdownOptionsJustText } from '@/utils/markdown'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Pill from '@polar-sh/ui/components/atoms/Pill'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import Markdown from 'markdown-to-jsx'
import Link from 'next/link'
import React, { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

interface ProductItemProps {
  product: schemas['Product']
}

const ProductItem = ({ product }: ProductItemProps) => {
  return (
    <div className="dark:bg-polar-800 dark:border-polar-700 flex flex-row items-center gap-6 rounded-3xl border border-gray-200 bg-white p-4">
      <ProductThumbnail product={product} size="medium" />
      <div className="flex flex-col gap-2">
        <div className="flex flex-row items-center gap-x-4">
          <h3 className="text-xl">{product.name}</h3>
          {product.is_archived && <Pill color="gray">Archived</Pill>}
        </div>
        {product.description && (
          <div
            className={twMerge(
              'prose dark:prose-invert dark:text-polar-500 flex-shrink leading-normal text-gray-500',
              'max-w-96 truncate',
            )}
          >
            <Markdown options={markdownOptionsJustText}>
              {product.description}
            </Markdown>
          </div>
        )}
      </div>
    </div>
  )
}

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
          <span className="dark:text-polar-500 font-mono text-sm text-gray-500">
            {subscription.id}
          </span>
        </div>
      }
      className="gap-y-8"
      contextView={
        <CustomerContextView
          customer={subscription.customer as schemas['Customer']}
        />
      }
      wide
    >
      <ShadowBox className="dark:divide-polar-700 flex flex-col divide-y divide-gray-200 border-gray-200 bg-transparent p-0">
        <div className="flex flex-col gap-6 p-8">
          <ProductItem product={product} />
          <div className="flex flex-row gap-4">
            {!product.is_archived && (
              <Link
                href={`/dashboard/${organization.slug}/products/${product.id}`}
              >
                <Button>View Product</Button>
              </Link>
            )}
            <Link
              href={`/dashboard/${organization.slug}/sales/subscriptions?product_id=${product.id}`}
            >
              <Button
                variant="secondary"
                className="bg-gray-300 hover:bg-gray-200"
              >
                All Product Subscriptions
              </Button>
            </Link>
          </div>
        </div>
        <div className="flex flex-col gap-6 p-8">
          <h2 className="text-xl">Subscription Details</h2>
          <div className="flex flex-col gap-6">
            <SubscriptionDetails subscription={subscription} />
          </div>
        </div>

        {(customFields?.items?.length ?? 0) > 0 && (
          <div className="flex flex-col gap-6 p-8">
            <h3 className="text-lg">Custom Fields</h3>
            <div className="flex flex-col gap-2">
              {customFields?.items?.map((field) => (
                <DetailRow key={field.id} title={field.name}>
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
                </DetailRow>
              ))}
            </div>
          </div>
        )}

        {Object.keys(subscription.metadata).length > 0 && (
          <div className="flex flex-col gap-6 p-8">
            <h3 className="text-lg">Metadata</h3>
            <div className="flex flex-col gap-2">
              {Object.entries(subscription.metadata).map(([key, value]) => (
                <DetailRow key={key} title={key}>
                  <span className="font-mono">{value}</span>
                </DetailRow>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-row gap-4 p-8">
          <Button type="button" onClick={showUpdateModal}>
            Update Subscription
          </Button>
          {subscription.status !== 'canceled' && (
            <Button
              type="button"
              variant="secondary"
              onClick={showCancellationModal}
            >
              Cancel Subscription
            </Button>
          )}

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
        </div>
      </ShadowBox>
    </DashboardBody>
  )
}

const DetailRow = ({
  title,
  children,
}: PropsWithChildren<{ title: string }>) => {
  return (
    <div className="flex flex-row justify-between gap-8">
      <span className="dark:text-polar-500 text-gray-500">{title}</span>
      {children}
    </div>
  )
}

export default ClientPage
