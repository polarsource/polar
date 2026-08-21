'use client'

import { ExportModal } from '@/components/Export/ExportModal'
import { useModal } from '@/components/Modal/useModal'
import { transactionsColumnConfig } from '@/components/Transactions/ExportTransactionsColumns'
import { useOrganizationAccount } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { Alert, Button, Text } from '@polar-sh/orbit'
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import { twMerge } from 'tailwind-merge'

export function IncomePageHeader({
  organization,
  className,
}: {
  organization: schemas['Organization']
  className?: string
}) {
  const { data: account } = useOrganizationAccount(organization.id)
  const {
    isShown: isExportModalShown,
    show: showExportModal,
    hide: hideExportModal,
  } = useModal()

  return (
    <>
      <Button
        onClick={showExportModal}
        className={twMerge(
          'flex w-full flex-row items-center md:w-auto',
          className,
        )}
        variant="secondary"
        wrapperClassNames="gap-x-2"
      >
        <FileDownloadOutlined fontSize="inherit" />
        <Text>Export</Text>
      </Button>
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
        isShown={isExportModalShown}
        hide={hideExportModal}
      />
    </>
  )
}
