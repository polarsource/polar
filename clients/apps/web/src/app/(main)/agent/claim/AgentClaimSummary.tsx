import { schemas } from '@polar-sh/client'
import { DEFAULT_LOCALE } from '@polar-sh/i18n'
import { formatDate } from '@polar-sh/i18n/formatters/date'
import { Alert, Avatar, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

const AgentClaimSummary = ({
  claim: { email, expires_at, organization },
}: {
  claim: schemas['AgentClaim']
}) => (
  <Box flexDirection="column" rowGap="l">
    {organization ? (
      <Box
        alignItems="center"
        columnGap="m"
        padding="l"
        borderRadius="l"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
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
