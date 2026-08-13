'use client'

import { OrderSection } from '@/components/Orders/OrderSection'
import { toast } from '@/components/Toast/use-toast'
import { useBenefitFiles } from '@/hooks/queries/benefits'
import { useDownloadFile } from '@/hooks/queries/files'
import { extractApiErrorMessage } from '@/utils/api/errors'
import ArrowDownward from '@mui/icons-material/ArrowDownward'
import { schemas } from '@polar-sh/client'
import { Button, List, ListItem, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useCallback } from 'react'

const DownloadableFileItem = ({
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
    <ListItem>
      <Box minWidth={0} flexGrow={1} flexDirection="column" rowGap="xs">
        <Text truncate>{file.name}</Text>
        <Box display={{ base: 'flex', md: 'none' }} columnGap="s">
          <Text variant="caption" color="muted" tabularNums>
            <Text
              as="span"
              variant="caption"
              color="muted"
              formatter="number"
              tabularNums
            >
              {file.downloaders}
            </Text>{' '}
            downloaders
          </Text>
          <Text variant="caption" color="muted" tabularNums>
            ·{' '}
            <Text
              as="span"
              variant="caption"
              color="muted"
              formatter="number"
              tabularNums
            >
              {file.downloads}
            </Text>{' '}
            downloads
          </Text>
        </Box>
      </Box>
      <Box flexShrink={0} alignItems="center" columnGap="m">
        <Box
          display={{ base: 'none', md: 'flex' }}
          width={88}
          justifyContent="end"
        >
          <Text color="muted" formatter="number" tabularNums>
            {file.downloaders}
          </Text>
        </Box>
        <Box
          display={{ base: 'none', md: 'flex' }}
          width={88}
          justifyContent="end"
        >
          <Text color="muted" formatter="number" tabularNums>
            {file.downloads}
          </Text>
        </Box>
        <Box width={80} justifyContent="end">
          <Text color="muted" tabularNums>
            {file.size_readable}
          </Text>
        </Box>
        <Box width={32}>
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
      </Box>
    </ListItem>
  )
}

export const DownloadablesSection = ({
  benefit,
}: {
  benefit: schemas['BenefitDownloadables']
}) => {
  const { files, archived } = benefit.properties
  const activeFileIds = files.filter((id) => !archived[id])
  const archivedCount = files.length - activeFileIds.length
  const { data, isLoading } = useBenefitFiles(benefit.id, activeFileIds.length)

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
        <Box flexDirection="column" rowGap="s">
          <Box
            display={{ base: 'none', md: 'flex' }}
            alignItems="center"
            columnGap="m"
            paddingHorizontal="l"
          >
            <Box flexGrow={1} />
            <Box width={88} justifyContent="end">
              <Text variant="caption" color="muted">
                Downloaders
              </Text>
            </Box>
            <Box width={88} justifyContent="end">
              <Text variant="caption" color="muted">
                Downloads
              </Text>
            </Box>
            <Box width={80} justifyContent="end">
              <Text variant="caption" color="muted">
                Size
              </Text>
            </Box>
            <Box width={32} />
          </Box>
          <List size="small">
            {(data?.items ?? []).map((file) => (
              <DownloadableFileItem key={file.id} file={file} />
            ))}
          </List>
        </Box>
      )}
    </OrderSection>
  )
}
