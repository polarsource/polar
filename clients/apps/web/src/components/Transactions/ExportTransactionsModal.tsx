'use client'

import { ExportModal } from '@/components/Export/ExportModal'
import { schemas } from '@polar-sh/client'
import { Alert } from '@polar-sh/orbit'
import React from 'react'
import { transactionsColumnConfig } from './ExportTransactionsColumns'

interface ExportTransactionsModalProps {
  organization: schemas['Organization']
  account?: schemas['Account'] | null
  isShown: boolean
  hide: () => void
}

const ExportTransactionsModal: React.FC<ExportTransactionsModalProps> = ({
  organization,
  account,
  isShown,
  hide,
}) => (
  <ExportModal
    start={new Date(organization.created_at)}
    endpoint="/v1/transactions/export"
    title="Export income"
    description="Download your income as a CSV file."
    dateRangeLabel="Date range"
    columnConfig={transactionsColumnConfig}
    exportDisabled={!account}
    banner={
      !account ? (
        <Alert
          variant="danger"
          title="No finance account"
          description="This organization doesn't have a finance account yet, so income can't be exported."
        />
      ) : null
    }
    buildParams={({ url, dateRange, timezone }) => {
      if (!account) {
        return
      }
      url.searchParams.set('account_id', account.id)
      url.searchParams.set('type', 'balance')
      url.searchParams.set('exclude_platform_fees', 'true')
      url.searchParams.set('created_after', dateRange.from.toISOString())
      url.searchParams.set('created_before', dateRange.to.toISOString())
      url.searchParams.set('timezone', timezone)
    }}
    isShown={isShown}
    hide={hide}
  />
)

export default ExportTransactionsModal
