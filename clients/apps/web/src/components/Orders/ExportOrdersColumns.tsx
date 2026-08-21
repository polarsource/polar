'use client'

import { schemas } from '@polar-sh/client'
import {
  ExportColumnGroup,
  createExportColumnConfig,
} from '@/components/Export/ExportColumns'

export type ExportColumn = schemas['OrderExportColumn']

const EXPORT_COLUMN_GROUPS = [
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

const DEFAULT_EXPORT_COLUMNS: ExportColumn[] = [
  'email',
  'created_at',
  'product',
  'net_amount',
  'currency',
  'status',
  'invoice_number',
]

export const ordersColumnConfig = createExportColumnConfig(
  EXPORT_COLUMN_GROUPS,
  DEFAULT_EXPORT_COLUMNS,
)
