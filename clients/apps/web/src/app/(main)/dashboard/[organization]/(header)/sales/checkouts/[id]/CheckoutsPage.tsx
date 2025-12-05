'use client'

import { CustomerContextView } from '@/components/Customer/CustomerContextView'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import PaymentMethod from '@/components/PaymentMethod/PaymentMethod'
import PaymentStatus from '@/components/PaymentStatus/PaymentStatus'
import { ProductListItem } from '@/components/Products/ProductListItem'
import { useCustomer } from '@/hooks/queries/customers'
import { usePayments } from '@/hooks/queries/payments'
import { schemas } from '@polar-sh/client'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { List } from '@polar-sh/ui/components/atoms/List'
import React from 'react'

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
    >
      <List size="small">
        {checkout.products.map((product) => (
          <ProductListItem
            key={product.id}
            organization={organization}
            product={product}
          />
        ))}
      </List>

      <div className="flex flex-col gap-6">
        <div className="flex flex-row items-center justify-between gap-x-8">
          <div className="flex flex-row items-center justify-between gap-x-6">
            <h3 className="text-lg">Payment Attempts</h3>
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
                  dateStyle="medium"
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

export default ClientPage
