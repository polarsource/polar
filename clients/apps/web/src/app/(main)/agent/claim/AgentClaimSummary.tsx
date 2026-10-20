import { schemas } from '@polar-sh/client'
import { DEFAULT_LOCALE } from '@polar-sh/i18n'
import { formatDate } from '@polar-sh/i18n/formatters/date'
import { Alert, Avatar, Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

const AgentClaimSummary = ({
  claim: { email, expires_at, organization },
}: {
  claim: schemas['AgentClaim']
}) => (
  <Box flexDirection="column" rowGap="l">
    {organization ? (
      <Box
        flexDirection="column"
        rowGap="l"
        padding="l"
        borderRadius="l"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Box alignItems="center" columnGap="m">
          <Avatar
            className="h-10 w-10"
            avatar_url={organization.avatar_url}
            name={organization.name}
          />
          <Box flexDirection="column">
            <Text variant="label">{organization.name}</Text>
            <Text variant="caption" color="muted">
              {organization.slug}
            </Text>
          </Box>
        </Box>
        <Grid templateColumns="repeat(3, 1fr)" gap="m">
          {[
            { label: 'Products', count: organization.product_count },
            { label: 'Benefits', count: organization.benefit_count },
            { label: 'Meters', count: organization.meter_count },
          ].map(({ label, count }) => (
            <Box
              key={label}
              flexDirection="column"
              rowGap="xs"
              padding="m"
              borderRadius="m"
              backgroundColor="background-card"
            >
              <Text variant="heading-xs">{count}</Text>
              <Text variant="caption" color="muted">
                {label}
              </Text>
            </Box>
          ))}
        </Grid>
      </Box>
    ) : (
      <Alert
        title="No organization yet"
        description="The agent hasn’t created an organization yet."
      />
    )}
    <Text variant="caption" color="muted">
      This claim is for {email} and expires on{' '}
      {formatDate(expires_at, DEFAULT_LOCALE, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })}
      .
    </Text>
  </Box>
)

export default AgentClaimSummary
