'use client'

import { OrderSection } from '@/components/Orders/OrderSection'
import { toast } from '@/components/Toast/use-toast'
import { useBenefitFiles } from '@/hooks/queries/benefits'
import { useDownloadFile } from '@/hooks/queries/files'
import { extractApiErrorMessage } from '@/utils/api/errors'
import ArrowDownward from '@mui/icons-material/ArrowDownward'
import { schemas } from '@polar-sh/client'
import {
  Button,
  DataTable,
  Text,
  type DataTableColumnDef,
  type DataTablePaginationState,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useCallback, useState } from 'react'

const DownloadFileButton = ({
  file,
}: {
  file: schemas['BenefitDownloadableFile']
}) => {
  const downloadFile = useDownloadFile(file.id, (fileDownload) => {
    window.location.href = fileDownload.download.url
  })

  const onDownload = useCallback(() => {
    const showFailure = (reason: string) =>
      toast({
        title: 'File Download Failed',
        description: `Error downloading file ${file.name}: ${reason}`,
      })

    downloadFile
      .mutateAsync()
      .then((response) => {
        if (response.error) {
          showFailure(extractApiErrorMessage(response.error))
        }
      })
      .catch(() => {
        showFailure('Please try again later')
      })
  }, [downloadFile, file.name])

  return (
    <Button
      size="icon"
      variant="secondary"
      className="h-8 w-8"
      onClick={onDownload}
      loading={downloadFile.isPending}
      aria-label={`Download ${file.name}`}
    >
      <ArrowDownward fontSize="inherit" />
    </Button>
  )
}

const columns: DataTableColumnDef<schemas['BenefitDownloadableFile']>[] = [
  {
    accessorKey: 'name',
    header: 'File',
    cell: ({ row: { original } }) => <Text truncate>{original.name}</Text>,
  },
  {
    accessorKey: 'downloaders',
    header: () => (
      <Box width="100%" justifyContent="end">
        <Text variant="caption" color="muted">
          Downloaders
        </Text>
      </Box>
    ),
    size: 120,
    cell: ({ row: { original } }) => (
      <Box justifyContent="end">
        <Text color="muted" formatter="number" tabularNums>
          {original.downloaders}
        </Text>
      </Box>
    ),
  },
  {
    accessorKey: 'downloads',
    header: () => (
      <Box width="100%" justifyContent="end">
        <Text variant="caption" color="muted">
          Downloads
        </Text>
      </Box>
    ),
    size: 120,
    cell: ({ row: { original } }) => (
      <Box justifyContent="end">
        <Text color="muted" formatter="number" tabularNums>
          {original.downloads}
        </Text>
      </Box>
    ),
  },
  {
    accessorKey: 'size_readable',
    header: () => (
      <Box width="100%" justifyContent="end">
        <Text variant="caption" color="muted">
          Size
        </Text>
      </Box>
    ),
    size: 100,
    cell: ({ row: { original } }) => (
      <Box justifyContent="end">
        <Text color="muted" tabularNums>
          {original.size_readable}
        </Text>
      </Box>
    ),
  },
  {
    id: 'actions',
    header: () => null,
    size: 56,
    cell: ({ row: { original } }) => (
      <Box justifyContent="end">
        <DownloadFileButton file={original} />
      </Box>
    ),
  },
]

export const DownloadablesSection = ({
  benefit,
}: {
  benefit: schemas['BenefitDownloadables']
}) => {
  const { files, archived } = benefit.properties
  const activeFileIds = files.filter((id) => !archived[id])
  const archivedCount = files.length - activeFileIds.length
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const { data, isLoading } = useBenefitFiles(
    benefit.id,
    {
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
    },
    activeFileIds.length > 0,
  )
  const activeCount = data?.pagination.total_count ?? activeFileIds.length

  return (
    <OrderSection
      title="Files"
      description={
        <Text color="muted">
          {activeCount} active
          {archivedCount > 0 ? `, ${archivedCount} archived` : ''}
        </Text>
      }
    >
      {activeFileIds.length === 0 ? (
        <Text color="muted">No files uploaded yet</Text>
      ) : (
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          isLoading={isLoading}
          rowCount={data?.pagination.total_count ?? 0}
          pageCount={data?.pagination.max_page ?? 1}
          pagination={pagination}
          onPaginationChange={setPagination}
        />
      )}
    </OrderSection>
  )
}
