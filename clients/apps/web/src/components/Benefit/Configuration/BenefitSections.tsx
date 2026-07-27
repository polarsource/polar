'use client'

import { OrderSection } from '@/components/Orders/OrderSection'
import { useFiles } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { List, ListItem, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { BenefitDetailsProps } from './BenefitDetails'

const Prose = ({
  children,
  fallback,
}: {
  children?: string | null
  fallback: string
}) =>
  children ? (
    // Notes and welcome messages are authored as multi-line text, so each
    // source line gets its own Text to keep the author's line breaks.
    <Box flexDirection="column" maxWidth="65ch">
      {children.split('\n').map((line, index) => (
        <Text key={index}>{line || '\u00a0'}</Text>
      ))}
    </Box>
  ) : (
    <Text color="muted">{fallback}</Text>
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
            <ListItem key={file.id} size="small" className="px-6 py-4">
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
}: BenefitDetailsProps) => {
  switch (benefit.type) {
    case 'custom':
      return (
        <OrderSection title="Private note">
          <Prose fallback="No note configured">{benefit.properties.note}</Prose>
        </OrderSection>
      )
    case 'downloadables':
      return (
        <DownloadablesSection benefit={benefit} organization={organization} />
      )
    case 'slack_shared_channel':
      return (
        <OrderSection title="Welcome message">
          <Prose fallback="No welcome message configured">
            {benefit.properties.welcome_message}
          </Prose>
        </OrderSection>
      )
    default:
      return null
  }
}
