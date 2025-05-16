'use client'

import { CustomerContextView } from '@/components/Customer/CustomerContextView'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import PaymentMethod from '@/components/PaymentMethod/PaymentMethod'
import PaymentStatus from '@/components/PaymentStatus/PaymentStatus'
import { useCustomer } from '@/hooks/queries/customers'
import { usePayments } from '@/hooks/queries/payments'
import { schemas } from '@polar-sh/client'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import React, { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

interface ClientPageProps {
  organization: schemas['Organization']
  checkout: schemas['Checkout']
}

const ClientPage: React.FC<ClientPageProps> = ({ organization, checkout }) => {
  const { customer_id } = checkout
  const { data: customer } = useCustomer(customer_id)
  const { data: payments, isLoading: paymentsLoading } = usePayments(
    organization.id,
    { checkout_id: checkout.id },
  )

  return (
    <DashboardBody
      title={
        <div className="flex flex-col gap-4">
          <div className="flex flex-row items-center gap-4">
            <h2 className="text-xl font-normal">Checkout</h2>
          </div>
          <span className="dark:text-polar-500 font-mono text-sm text-gray-500">
            {checkout.id}
          </span>
        </div>
      }
      className="gap-y-8"
      contextViewClassName="bg-transparent dark:bg-transparent border-none rounded-none"
      contextView={
        customer ? (
          <CustomerContextView
            organization={organization}
            customer={customer}
          />
        ) : undefined
      }
      wide
    >
      <ShadowBox className="dark:divide-polar-700 flex flex-col divide-y divide-gray-200 border-gray-200 bg-transparent p-0">
        <div className="flex flex-col gap-6 p-8">
          <div className="flex flex-col gap-1">
            <DetailRow title="Products">
              <span className="dark:text-polar-500 font-mono text-sm text-gray-500">
                {checkout.products.map(({ name }) => name).join(', ')}
              </span>
            </DetailRow>
          </div>
        </div>
      </ShadowBox>

      <div className="flex flex-col gap-6">
        <div className="flex flex-row items-center justify-between gap-x-8">
          <div className="flex flex-row items-center justify-between gap-x-6">
            <h3 className="text-lg">Payment attempts</h3>
          </div>
        </div>

        <DataTable
          isLoading={paymentsLoading}
          columns={[
            {
              accessorKey: 'created_at',
              header: 'Created At',
              cell: ({
                row: {
                  original: { created_at },
                },
              }) => (
                <FormattedDateTime
                  dateStyle="short"
                  resolution="time"
                  datetime={created_at}
                />
              ),
            },
            {
              accessorKey: 'method',
              header: 'Method',
              cell: ({ row: { original } }) => (
                <PaymentMethod payment={original} />
              ),
            },
            {
              accessorKey: 'status',
              header: 'Status',
              cell: ({ row: { original } }) => (
                <PaymentStatus payment={original} />
              ),
            },
          ]}
          data={payments?.items ?? []}
        />
      </div>
    </DashboardBody>
  )
}

const DetailRow = ({
  title,
  children,
  className,
  titleClassName,
}: PropsWithChildren<{
  title: string
  className?: string
  titleClassName?: string
}>) => {
  return (
    <div className={twMerge('flex flex-row justify-between gap-8', className)}>
      <span
        className={twMerge('dark:text-polar-500 text-gray-500', titleClassName)}
      >
        {title}
      </span>
      {children}
    </div>
  )
}

export default ClientPage
