'use client'

import { VoidSection } from '@/components/Void/VoidSection'
import { useListOrganizationMembers } from '@/hooks/queries/org'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useContext } from 'react'

const shortDate = (timestamp: string) =>
  new Date(timestamp).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

export default function ClientPage() {
  const { organization } = useContext(OrganizationContext)
  const { data } = useListOrganizationMembers(organization.id)

  const members = data?.items ?? []

  return (
    <Box as="main" flexDirection="column" paddingTop="5xl" flexGrow={1}>
      <VoidSection label="Settings" meta={`${members.length} members`}>
        {members.length > 0 ? (
          <Box flexDirection="column" rowGap="xl">
            {members.map((member) => (
              <Grid
                key={member.user_id}
                templateColumns={{ base: '1fr auto', md: '2fr 1fr 1fr' }}
                gap="l"
                alignItems="baseline"
              >
                <Text variant="heading-xs" truncate>
                  {member.email}
                </Text>
                <Text variant="heading-xxs" color="muted">
                  {member.role}
                </Text>
                <Text variant="heading-xxs" color="muted" align="right">
                  {`joined ${shortDate(member.created_at)}`}
                </Text>
              </Grid>
            ))}
          </Box>
        ) : (
          <Text variant="heading-m" color="muted">
            No members yet
          </Text>
        )}
      </VoidSection>
    </Box>
  )
}
