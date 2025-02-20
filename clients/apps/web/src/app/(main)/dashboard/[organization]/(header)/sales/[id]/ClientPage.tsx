'use client'

import { CustomerContextView } from '@/components/Customer/CustomerContextView'
import CustomFieldValue from '@/components/CustomFields/CustomFieldValue'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { ProductThumbnail } from '@/components/Products/ProductThumbnail'
import { RefundModal } from '@/components/Refunds/RefundModal'
import {
  RefundReasonDisplay,
  RefundStatusDisplayColor,
  RefundStatusDisplayTitle,
} from '@/components/Refunds/utils'
import { useCustomFields, useProduct } from '@/hooks/queries'
import { useOrder } from '@/hooks/queries/orders'
import { useRefunds } from '@/hooks/queries/refunds'
import { markdownOptionsJustText } from '@/utils/markdown'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Pill from '@polar-sh/ui/components/atoms/Pill'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { Separator } from '@radix-ui/react-dropdown-menu'
import Markdown from 'markdown-to-jsx'
import Link from 'next/link'
import React, { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

interface OrderProductItemProps {
  product: schemas['Product']
}

const OrderProductItem = ({ product }: OrderProductItemProps) => {
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

const OrderStatusDisplayName: Record<string, string> = {
  paid: 'Paid',
  refunded: 'Refunded',
  partially_refunded: 'Partially Refunded',
}

const OrderStatusDisplayColor: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950',
  refunded: 'bg-blue-100 text-blue-400 dark:bg-blue-950',
  partially_refunded: 'bg-purple-100 text-purple-500 dark:bg-purple-950',
}

interface ClientPageProps {
  organization: schemas['Organization']
  order: schemas['Order']
}

const ClientPage: React.FC<ClientPageProps> = ({
  organization,
  order: _order,
}) => {
  const { data: order } = useOrder(_order.id, _order)
  const { data: product } = useProduct(_order.product.id)
  const { data: customFields } = useCustomFields(organization.id)
  const { data: refunds, isLoading: refundsLoading } = useRefunds(_order.id)

  const {
    isShown: isRefundModalShown,
    show: showRefundModal,
    hide: hideRefundModal,
  } = useModal()

  const canRefund = (order?.refunded_amount ?? 0) < (order?.amount ?? 0)

  if (!order || !product) {
    return null
  }

  return (
    <DashboardBody
      title={
        <div className="flex flex-col gap-4">
          <div className="flex flex-row items-center gap-4">
            <h2 className="text-xl font-normal">Order</h2>
            <Status
              status={OrderStatusDisplayName[order.status]}
              className={OrderStatusDisplayColor[order.status]}
            />
          </div>
          <span className="dark:text-polar-500 font-mono text-sm text-gray-500">
            {order.id}
          </span>
        </div>
      }
      className="gap-y-8"
      contextView={
        <CustomerContextView customer={order.customer as schemas['Customer']} />
      }
      wide
    >
      <ShadowBox className="dark:divide-polar-700 flex flex-col divide-y divide-gray-200 border-gray-200 bg-transparent p-0">
        <div className="flex flex-col gap-6 p-8">
          <OrderProductItem product={product} />
          <div className="flex flex-row gap-4">
            {!product.is_archived && (
              <Link
                href={`/dashboard/${organization.slug}/products/${product.id}`}
              >
                <Button>View Product</Button>
              </Link>
            )}
            <Link
              href={`/dashboard/${organization.slug}/sales?product_id=${product.id}`}
            >
              <Button
                variant="secondary"
                className="bg-gray-300 hover:bg-gray-200"
              >
                All Product Orders
              </Button>
            </Link>
          </div>
        </div>
        <div className="flex flex-col gap-6 p-8">
          <h2 className="text-xl">Order Details</h2>
          <div className="flex flex-col gap-1">
            <DetailRow title="Order ID">
              <span className="dark:text-polar-500 font-mono text-sm text-gray-500">
                {order.id}
              </span>
            </DetailRow>
            <DetailRow title="Order Date">
              <span>
                <FormattedDateTime
                  dateStyle="long"
                  datetime={order.created_at}
                />
              </span>
            </DetailRow>
            <DetailRow title="Billing Reason">
              <Status
                status={order.billing_reason.split('_').join(' ')}
                className="bg-emerald-100 capitalize text-emerald-500 dark:bg-emerald-950"
              />
            </DetailRow>

            <Separator className="dark:bg-polar-700 my-4 h-[1px] bg-gray-300" />

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
                <Separator className="dark:bg-polar-700 my-4 h-[1px] bg-gray-300" />
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
              </>
            ) : (
              <></>
            )}
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
                      order.custom_field_data
                        ? order.custom_field_data[
                            field.slug as keyof typeof order.custom_field_data
                          ]
                        : undefined
                    }
                  />
                </DetailRow>
              ))}
            </div>
          </div>
        )}

        {Object.keys(order.metadata).length > 0 && (
          <div className="flex flex-col gap-6 p-8">
            <h3 className="text-lg">Metadata</h3>
            <div className="flex flex-col gap-2">
              {Object.entries(order.metadata).map(([key, value]) => (
                <DetailRow key={key} title={key}>
                  <span className="font-mono">{value}</span>
                </DetailRow>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-6 p-8">
          <div className="flex flex-row items-center justify-between gap-x-8">
            <div className="flex flex-row items-center justify-between gap-x-6">
              <h3 className="text-lg">Refunds</h3>
              {order.status != 'paid' && (
                <Status
                  status={OrderStatusDisplayName[order.status]}
                  className={OrderStatusDisplayColor[order.status]}
                />
              )}
            </div>
            {canRefund && (
              <Button onClick={showRefundModal}>Refund Order</Button>
            )}
          </div>

          <DataTable
            isLoading={refundsLoading}
            columns={[
              {
                accessorKey: 'created_at',
                header: 'Created At',
                cell: ({ row }) => (
                  <FormattedDateTime
                    dateStyle="long"
                    datetime={row.original.created_at}
                  />
                ),
              },
              {
                accessorKey: 'amount',
                header: 'Amount',
                cell: ({ row }) =>
                  formatCurrencyAndAmount(
                    row.original.amount,
                    row.original.currency,
                  ),
              },
              {
                accessorKey: 'status',
                header: 'Status',
                cell: ({ row }) => (
                  <Status
                    className={twMerge(
                      RefundStatusDisplayColor[row.original.status],
                      'w-fit',
                    )}
                    status={RefundStatusDisplayTitle[row.original.status]}
                  />
                ),
              },
              {
                accessorKey: 'reason',
                header: 'Reason',
                cell: ({ row }) => RefundReasonDisplay[row.original.reason],
              },
              {
                accessorKey: 'revoke_benefits',
                header: 'Revoke Benefits',
                cell: ({ row }) => (
                  <Status
                    status={row.original.revoke_benefits ? 'True' : 'False'}
                    className={twMerge(
                      'w-fit',
                      row.original.revoke_benefits
                        ? 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950'
                        : 'bg-red-100 text-red-500 dark:bg-red-950',
                    )}
                  />
                ),
              },
            ]}
            data={refunds?.items ?? []}
          />
        </div>
      </ShadowBox>
      <InlineModal
        isShown={isRefundModalShown}
        hide={hideRefundModal}
        modalContent={<RefundModal order={order} hide={hideRefundModal} />}
      />
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
