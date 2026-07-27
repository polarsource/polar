'use client'

import { OrderSection } from '@/components/Orders/OrderSection'
import { useFiles } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { List, ListItem, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { BenefitConfigurationProps } from './BenefitConfigurationProps'

const ProseSection = ({
  title,
  text,
  fallback,
}: {
  title: string
  text?: string | null
  fallback: string
}) => (
  <OrderSection title={title}>
    <Box backgroundColor="background-secondary" borderRadius="l" padding="xl">
      {text ? (
        // Notes and welcome messages are authored as multi-line text, so the
        // author's line breaks are preserved as written.
        <div className="max-w-[65ch] whitespace-pre-wrap">
          <Text>{text}</Text>
        </div>
      ) : (
        <Text color="muted">{fallback}</Text>
      )}
    </Box>
  </OrderSection>
)

const DownloadablesSection = ({
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
            <ListItem key={file.id}>
              <Box minWidth={0} flexGrow={1}>
                <Text truncate>{file.name}</Text>
              </Box>
              <Box flexShrink={0}>
                <Text color="muted" tabularNums>
                  {file.size_readable}
                </Text>
              </Box>
            </ListItem>
          ))}
        </List>
      )}
    </OrderSection>
  )
}

export const BenefitSections = ({
  benefit,
  organization,
}: BenefitConfigurationProps) => {
  switch (benefit.type) {
    case 'custom':
      return (
        <ProseSection
          title="Private note"
          text={benefit.properties.note}
          fallback="No note configured"
        />
      )
    case 'downloadables':
      return (
        <DownloadablesSection benefit={benefit} organization={organization} />
      )
    case 'slack_shared_channel':
      return (
        <ProseSection
          title="Welcome message"
          text={benefit.properties.welcome_message}
          fallback="No welcome message configured"
        />
      )
    default:
      return null
  }
}
