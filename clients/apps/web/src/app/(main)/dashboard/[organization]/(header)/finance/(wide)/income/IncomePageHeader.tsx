'use client'

import { useModal } from '@/components/Modal/useModal'
import ExportTransactionsModal from '@/components/Transactions/ExportTransactionsModal'
import { useOrganizationAccount } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
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
      <ExportTransactionsModal
        organization={organization}
        account={account}
        isShown={isExportModalShown}
        hide={hideExportModal}
      />
    </>
  )
}
