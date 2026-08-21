'use client'

import { ExportModal } from '@/components/Export/ExportModal'
import { schemas } from '@polar-sh/client'
import React from 'react'
import { ordersColumnConfig } from './ExportOrdersColumns'

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
    start={new Date(organization.created_at)}
    endpoint="/v1/orders/export"
    title="Export orders"
    description="Download your orders as a CSV file."
    dateRangeLabel="Date range"
    columnConfig={ordersColumnConfig}
    buildParams={({ url, dateRange, timezone }) => {
      url.searchParams.set('organization_id', organization.id)
      for (const id of productId ?? []) {
        url.searchParams.append('product_id', id)
      }
      if (status) {
        url.searchParams.append('status', status)
      }
      url.searchParams.set('created_after', dateRange.from.toISOString())
      url.searchParams.set('created_before', dateRange.to.toISOString())
      url.searchParams.set('timezone', timezone)
    }}
    isShown={isShown}
    hide={hide}
  />
)

export default ExportOrdersModal
