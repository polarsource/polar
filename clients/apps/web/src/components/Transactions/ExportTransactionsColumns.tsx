'use client'

import { schemas } from '@polar-sh/client'
import {
  ExportColumnGroup,
  createExportColumnConfig,
} from '@/components/Export/ExportColumns'

export type ExportColumn = schemas['TransactionExportColumn']

const EXPORT_COLUMN_GROUPS = [
  {
    label: 'Transaction',
    columns: [
      { value: 'created_at', label: 'Created At' },
      { value: 'type', label: 'Type' },
      { value: 'product', label: 'Product' },
      { value: 'status', label: 'Status' },
      { value: 'paid_out_at', label: 'Paid out at' },
      { value: 'invoice_number', label: 'Invoice number' },
      { value: 'order_id', label: 'Order ID' },
    ],
  },
  {
    label: 'Amounts',
    columns: [
      { value: 'gross_amount', label: 'Gross' },
      { value: 'fees', label: 'Fees' },
      { value: 'tax_amount', label: 'Tax' },
      { value: 'net_amount', label: 'Net' },
      { value: 'currency', label: 'Currency' },
    ],
  },
] as const satisfies readonly ExportColumnGroup<ExportColumn>[]

const DEFAULT_EXPORT_COLUMNS: ExportColumn[] = [
  'created_at',
  'type',
  'product',
  'gross_amount',
  'fees',
  'tax_amount',
  'net_amount',
  'currency',
  'status',
  'paid_out_at',
]

export const transactionsColumnConfig = createExportColumnConfig(
  EXPORT_COLUMN_GROUPS,
  DEFAULT_EXPORT_COLUMNS,
)
