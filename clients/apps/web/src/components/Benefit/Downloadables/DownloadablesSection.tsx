'use client'

import { OrderSection } from '@/components/Orders/OrderSection'
import { toast } from '@/components/Toast/use-toast'
import { useDownloadFile, useFiles } from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import ArrowDownward from '@mui/icons-material/ArrowDownward'
import { schemas } from '@polar-sh/client'
import { Button, List, ListItem, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useCallback } from 'react'

const DownloadableFileItem = ({ file }: { file: schemas['FileRead'] }) => {
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
    <ListItem>
      <Box minWidth={0} flexGrow={1}>
        <Text truncate>{file.name}</Text>
      </Box>
      <Box flexShrink={0} alignItems="center" columnGap="m">
        <Text color="muted" tabularNums>
          {file.size_readable}
        </Text>
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
      </Box>
    </ListItem>
  )
}

export const DownloadablesSection = ({
  benefit,
  organization,
}: {
  benefit: schemas['BenefitDownloadables']
  organization: schemas['Organization']
}) => {
  const { files, archived } = benefit.properties
  const activeFileIds = files.filter((id) => !archived[id])
  const archivedCount = files.length - activeFileIds.length
  const { data, isLoading } = useFiles(organization.id, activeFileIds)

  return (
    <OrderSection
      title="Files"
      description={
        <Text color="muted">
          {activeFileIds.length} active
          {archivedCount > 0 ? `, ${archivedCount} archived` : ''}
        </Text>
      }
    >
      {activeFileIds.length === 0 ? (
        <Text color="muted">No files uploaded yet</Text>
      ) : isLoading ? (
        <Text loading placeholderText="File name" />
      ) : (
        <List size="small">
          {(data?.items ?? []).map((file) => (
            <DownloadableFileItem key={file.id} file={file} />
          ))}
        </List>
      )}
    </OrderSection>
  )
}
