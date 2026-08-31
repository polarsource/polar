'use client'

import { VoidSection } from '@/components/Void/VoidSection'
import { useOrganizationAccessTokens } from '@/hooks/queries/org'
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
  const { data } = useOrganizationAccessTokens(organization.id)

  const tokens = data?.items ?? []

  return (
    <Box as="main" flexDirection="column" paddingTop="5xl" flexGrow={1}>
      <VoidSection label="Settings" meta={`${tokens.length} access tokens`}>
        {tokens.length > 0 ? (
          <Box flexDirection="column" rowGap="xl">
            {tokens.map((token) => (
              <Grid
                key={token.id}
                templateColumns={{ base: '1fr auto', md: '2fr 1fr 1fr' }}
                gap="l"
                alignItems="baseline"
              >
                <Text variant="heading-xs" truncate>
                  {token.comment}
                </Text>
                <Text variant="heading-xxs" color="muted">
                  {`${token.scopes.length} scopes / ${
                    token.last_used_at
                      ? `used ${shortDate(token.last_used_at)}`
                      : 'never used'
                  }`}
                </Text>
                <Text variant="heading-xxs" color="muted" align="right">
                  {token.expires_at
                    ? `expires ${shortDate(token.expires_at)}`
                    : 'no expiry'}
                </Text>
              </Grid>
            ))}
          </Box>
        ) : (
          <Box flexDirection="column" rowGap="s" paddingVertical="2xl">
            <Text variant="heading-m" color="muted">
              No access tokens
            </Text>
            <Text variant="heading-xxs" color="muted">
              Authenticate with the Polar API to push billing definitions
            </Text>
          </Box>
        )}
      </VoidSection>
    </Box>
  )
}
