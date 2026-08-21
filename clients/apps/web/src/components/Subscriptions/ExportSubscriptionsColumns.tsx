'use client'

import { schemas } from '@polar-sh/client'
import {
  ExportColumnGroup,
  createExportColumnConfig,
} from '@/components/Export/ExportColumns'

export type ExportColumn = schemas['SubscriptionExportColumn']

const EXPORT_COLUMN_GROUPS = [
  {
    label: 'Subscription',
    columns: [
      { value: 'started_at', label: 'Started At' },
      { value: 'status', label: 'Status' },
      { value: 'recurring_interval', label: 'Billing Interval' },
      { value: 'current_period_start', label: 'Current Period Start' },
      { value: 'current_period_end', label: 'Current Period End' },
      { value: 'seats', label: 'Seats' },
      { value: 'trial_start', label: 'Trial Start' },
      { value: 'trial_end', label: 'Trial End' },
    ],
  },
  {
    label: 'Cancellation',
    columns: [
      { value: 'cancel_at_period_end', label: 'Cancels At Period End' },
      { value: 'canceled_at', label: 'Canceled At' },
      { value: 'ends_at', label: 'Ends At' },
      { value: 'ended_at', label: 'Ended At' },
      { value: 'cancellation_reason', label: 'Cancellation Reason' },
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
    label: 'Product & Amounts',
    columns: [
      { value: 'product', label: 'Product' },
      { value: 'amount', label: 'Amount' },
      { value: 'currency', label: 'Currency' },
      { value: 'discount', label: 'Discount' },
      { value: 'net_amount', label: 'Net Amount' },
    ],
  },
] as const satisfies readonly ExportColumnGroup<ExportColumn>[]

const DEFAULT_EXPORT_COLUMNS: ExportColumn[] = [
  'email',
  'started_at',
  'product',
  'amount',
  'currency',
  'status',
  'recurring_interval',
]

export const subscriptionsColumnConfig = createExportColumnConfig(
  EXPORT_COLUMN_GROUPS,
  DEFAULT_EXPORT_COLUMNS,
)
