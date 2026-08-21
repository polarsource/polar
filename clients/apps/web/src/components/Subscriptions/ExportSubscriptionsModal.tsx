'use client'

import { ExportModal } from '@/components/Export/ExportModal'
import { schemas } from '@polar-sh/client'
import React from 'react'
import { subscriptionsColumnConfig } from './ExportSubscriptionsColumns'
import type { SubscriptionStatusFilter } from './SubscriptionStatusSelect'

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
    start={new Date(organization.created_at)}
    endpoint="/v1/subscriptions/export"
    title="Export subscriptions"
    description="Download your subscriptions as a CSV file."
    dateRangeLabel="Started between"
    columnConfig={subscriptionsColumnConfig}
    buildParams={({ url, dateRange, timezone }) => {
      url.searchParams.set('organization_id', organization.id)
      if (productId) {
        url.searchParams.append('product_id', productId)
      }
      if (status !== 'any') {
        url.searchParams.append('status', status)
      }
      if (cancelAtPeriodEnd !== null && cancelAtPeriodEnd !== undefined) {
        url.searchParams.set('cancel_at_period_end', String(cancelAtPeriodEnd))
      }
      url.searchParams.set('started_after', dateRange.from.toISOString())
      url.searchParams.set('started_before', dateRange.to.toISOString())
      url.searchParams.set('timezone', timezone)
    }}
    isShown={isShown}
    hide={hide}
  />
)

export default ExportSubscriptionsModal
