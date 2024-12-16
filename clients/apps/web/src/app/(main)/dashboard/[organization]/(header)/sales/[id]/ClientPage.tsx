'use client'

import CustomFieldValue from '@/components/CustomFields/CustomFieldValue'
import { CustomerModal } from '@/components/Customer/CustomerModal'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { BenefitList } from '@/components/Products/BenefitList'
import { ProductThumbnail } from '@/components/Products/ProductThumbnail'
import { useCustomFields, useProduct } from '@/hooks/queries'
import { useOrder, useOrders } from '@/hooks/queries/orders'
import { markdownOptionsJustText } from '@/utils/markdown'
import { Organization, OrderProduct, Order, Product} from '@polar-sh/sdk'
import { formatCurrencyAndAmount } from '@polarkit/lib/money'
import { Separator } from '@radix-ui/react-dropdown-menu'
import Markdown from 'markdown-to-jsx'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormattedDateTime } from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import React, { PropsWithChildren, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface OrderProductItemProps {
  product: Product
}

const OrderProductItem = ({ product }: OrderProductItemProps) => {


  return (
    <div className="flex bg-gray-100 dark:bg-polar-800 flex-row items-center gap-6 border border-gray-200 dark:border-polar-700 rounded-3xl p-4">
      <ProductThumbnail product={product} size="medium" />
      <div className="flex flex-col gap-2">
        <h3 className="text-xl">{product.name}</h3>
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
  organization: Organization
  orderId: string
}

const ClientPage: React.FC<ClientPageProps> = ({
 organization,
  orderId
}) => {
  const { data: order } = useOrder(orderId)
  const { data: product } = useProduct(order?.product.id)
  const { data: customFields } = useCustomFields(organization.id)

  if (!order || !product) {
    return null
  }


  return (
    <DashboardBody
      title={
        <div className='flex flex-row items-baseline gap-8'>
          <h2 className="text-xl font-normal">Order</h2>
          <span className='text-gray-500 font-mono text-sm dark:text-polar-500'>{order.id}</span>
        </div>
      }
      className='gap-y-8'
      contextView={<CustomerModal customer={order.customer} />}
    >
      <ShadowBox className="flex flex-col gap-8">
        <OrderProductItem product={product} />
        <div className="flex flex-row gap-4">
          <Link href={`/dashboard/${organization.slug}/products/${product.id}`}>
            <Button>View Product</Button>
          </Link>
          <Link href={`/dashboard/${organization.slug}/sales?product_id=${product.id}`}>
            <Button variant="secondary">All Product Orders</Button>
          </Link>
        </div>
      </ShadowBox>
      <ShadowBox className="flex flex-col gap-8">
        <h2 className="text-xl">Order Details</h2>
        <div className="flex flex-col gap-1">
          <DetailRow title="Order ID">
            <span className='font-mono text-sm'>{order.id}</span>
          </DetailRow>
          <DetailRow title="Order Date">
            <span><FormattedDateTime dateStyle='long' datetime={order.created_at} /></span>
          </DetailRow>
          <DetailRow title="Billing Reason">
            <span className='capitalize'>{order.billing_reason.split('_').join(' ')}</span>
          </DetailRow>

          <Separator className='h-[1px] my-4 dark:bg-polar-700 bg-gray-200' />

          <DetailRow title="Tax">
            <span>{formatCurrencyAndAmount(order.tax_amount)}</span>
          </DetailRow>
          <DetailRow title="Discount">
            <span>{order.discount ? order.discount.code : '—'}</span>
          </DetailRow>
          <DetailRow title="Amount">
            <span>{formatCurrencyAndAmount(order.amount)}</span>
          </DetailRow>
          {order.billing_address ? (
            <>
              <Separator className='h-[1px] my-4 dark:bg-polar-700 bg-gray-200' />
              <DetailRow title="Country">
                <span>{order.billing_address?.country}</span>
              </DetailRow>
              <DetailRow title="Address">
                <span>{order.billing_address?.line1 ?? '—'}</span>
              </DetailRow>
              <DetailRow title="Address 2">
              <span>{order.billing_address?.line2 ?? '—'}</span>
              </DetailRow>
              <DetailRow title="Postal Code">
                <span>{order.billing_address?.postal_code ?? '—'}</span>
              </DetailRow>
              <DetailRow title="City">
                <span>{order.billing_address?.city ?? '—'}</span>
              </DetailRow>
              <DetailRow title="State">
                <span>{order.billing_address?.state ?? '—'}</span>
              </DetailRow>
            </>) : <></>}
        </div>
      </ShadowBox>

      {(customFields?.items?.length ?? 0) > 0 && (
        <ShadowBox className="flex flex-col gap-8">
          <h3 className="text-lg">Custom Fields</h3>
          <div className="flex flex-col gap-2">
            {customFields?.items?.map((field) => (
              <div key={field.slug} className="flex flex-col gap-y-2">
                <span>{field.name}</span>
                <div className="font-mono text-sm">
                  <CustomFieldValue
                    field={field}
                    value={
                      order.custom_field_data
                        ? order.custom_field_data[
                            field.slug as keyof typeof order.custom_field_data
                          ]
                        : undefined
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </ShadowBox>
      )}
    </DashboardBody>
  )
}

const DetailRow = ({ title, children }: PropsWithChildren<{ title: string;}>) => {
  return (
    <div className="flex flex-row justify-between gap-8">
      <span className="dark:text-polar-500 text-gray-500">{title}</span>
      {children}
    </div>
  )
}

export default ClientPage
