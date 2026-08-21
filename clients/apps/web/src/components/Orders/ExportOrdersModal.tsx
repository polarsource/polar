'use client'

import { ExportModal } from '@/components/Export/ExportModal'
import { ExportColumnGroup } from '@/components/Export/ExportColumns'
import { downloadCsvExport } from '@/components/Export/utils'
import { schemas } from '@polar-sh/client'
import React from 'react'

type ExportColumn = schemas['OrderExportColumn']

const columnGroups = [
  {
    label: 'Order',
    columns: [
      { value: 'created_at', label: 'Created At' },
      { value: 'product', label: 'Product' },
      { value: 'status', label: 'Status' },
      { value: 'billing_reason', label: 'Billing Reason' },
      { value: 'invoice_number', label: 'Invoice number' },
    ],
  },
  {
    label: 'Customer',
    columns: [
      { value: 'email', label: 'Email' },
      { value: 'customer_name', label: 'Customer Name' },
      { value: 'billing_name', label: 'Billing Name' },
      { value: 'billing_country', label: 'Billing Country' },
    ],
  },
  {
    label: 'Amounts',
    columns: [
      { value: 'net_amount', label: 'Net Amount' },
      { value: 'currency', label: 'Currency' },
      { value: 'subtotal_amount', label: 'Subtotal' },
      { value: 'discount_amount', label: 'Discount' },
      { value: 'tax_amount', label: 'Tax' },
      { value: 'total_amount', label: 'Total' },
      { value: 'refunded_amount', label: 'Refunded Amount' },
    ],
  },
] as const satisfies readonly ExportColumnGroup<ExportColumn>[]

const defaultColumns: ExportColumn[] = [
  'email',
  'created_at',
  'product',
  'net_amount',
  'currency',
  'status',
  'invoice_number',
]

interface ExportOrdersModalProps {
  organization: schemas['Organization']
  productId?: string[]
  status?: schemas['OrderStatus'] | null
  isShown: boolean
  hide: () => void
}

const ExportOrdersModal: React.FC<ExportOrdersModalProps> = ({
  organization,
  productId,
  status,
  isShown,
  hide,
}) => (
  <ExportModal
    start={organization.created_at}
    title="Export orders"
    description="Download your orders as a CSV file."
    dateRangeLabel="Date range"
    columns={columnGroups}
    defaultColumns={defaultColumns}
    onExport={(selection) =>
      downloadCsvExport(
        '/v1/orders/export',
        selection,
        (search, { dateRange, timezone }) => {
          search.set('organization_id', organization.id)
          for (const id of productId ?? []) {
            search.append('product_id', id)
          }
          if (status) {
            search.append('status', status)
          }
          search.set('created_after', dateRange.from.toISOString())
          search.set('created_before', dateRange.to.toISOString())
          search.set('timezone', timezone)
        },
      )
    }
    isShown={isShown}
    hide={hide}
  />
)

export default ExportOrdersModal
