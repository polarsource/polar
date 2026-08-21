'use client'

import { ExportModal } from '@/components/Export/ExportModal'
import { ExportColumnGroup } from '@/components/Export/ExportColumns'
import { downloadCsvExport } from '@/components/Export/utils'
import { schemas } from '@polar-sh/client'
import { Alert } from '@polar-sh/orbit'
import React from 'react'

type ExportColumn = schemas['TransactionExportColumn']

const columnGroups = [
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

const defaultColumns: ExportColumn[] = [
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
    start={organization.created_at}
    title="Export income"
    description="Download your income as a CSV file."
    dateRangeLabel="Date range"
    columns={columnGroups}
    defaultColumns={defaultColumns}
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
    onExport={(selection) => {
      if (!account) {
        return
      }
      downloadCsvExport(
        '/v1/transactions/export',
        selection,
        (search, { dateRange, timezone }) => {
          search.set('account_id', account.id)
          search.set('type', 'balance')
          search.set('exclude_platform_fees', 'true')
          search.set('created_after', dateRange.from.toISOString())
          search.set('created_before', dateRange.to.toISOString())
          search.set('timezone', timezone)
        },
      )
    }}
    isShown={isShown}
    hide={hide}
  />
)

export default ExportTransactionsModal
