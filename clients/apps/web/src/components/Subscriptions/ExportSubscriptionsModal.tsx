'use client'

import { ExportModal } from '@/components/Export/ExportModal'
import { ExportColumnGroup } from '@/components/Export/ExportColumns'
import { downloadCsvExport } from '@/components/Export/utils'
import { schemas } from '@polar-sh/client'
import React from 'react'
import { SubscriptionStatusFilter } from './SubscriptionStatusSelect'

type ExportColumn = schemas['SubscriptionExportColumn']

const columnGroups = [
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

const defaultColumns: ExportColumn[] = [
  'email',
  'started_at',
  'product',
  'amount',
  'currency',
  'status',
  'recurring_interval',
]

interface ExportSubscriptionsModalProps {
  organization: schemas['Organization']
  productId?: string | null
  status: SubscriptionStatusFilter
  cancelAtPeriodEnd?: boolean | null
  isShown: boolean
  hide: () => void
}

const ExportSubscriptionsModal: React.FC<ExportSubscriptionsModalProps> = ({
  organization,
  productId,
  status,
  cancelAtPeriodEnd,
  isShown,
  hide,
}) => (
  <ExportModal
    start={organization.created_at}
    title="Export subscriptions"
    description="Download your subscriptions as a CSV file."
    dateRangeLabel="Started between"
    columns={columnGroups}
    defaultColumns={defaultColumns}
    onExport={(selection) =>
      downloadCsvExport(
        '/v1/subscriptions/export',
        selection,
        (search, { dateRange, timezone }) => {
          search.set('organization_id', organization.id)
          if (productId) {
            search.append('product_id', productId)
          }
          if (status !== 'any') {
            search.append('status', status)
          }
          if (cancelAtPeriodEnd !== null && cancelAtPeriodEnd !== undefined) {
            search.set('cancel_at_period_end', String(cancelAtPeriodEnd))
          }
          search.set('started_after', dateRange.from.toISOString())
          search.set('started_before', dateRange.to.toISOString())
          search.set('timezone', timezone)
        },
      )
    }
    isShown={isShown}
    hide={hide}
  />
)

export default ExportSubscriptionsModal
