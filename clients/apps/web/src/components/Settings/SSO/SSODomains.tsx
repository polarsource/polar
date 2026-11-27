import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'

type VerifiedDomain = schemas['OrganizationDomain'] & { verified_at: string }

export const isVerifiedDomain = (
  domain: schemas['OrganizationDomain'],
): domain is VerifiedDomain => domain.verified_at !== null

const SSODomains = ({ domains }: { domains: VerifiedDomain[] }) => (
  <Box flexDirection="column" rowGap="s" width="100%">
    {domains.map((domain) => (
      <Box key={domain.id} alignItems="center" justifyContent="between">
        <Text>{domain.domain}</Text>
        <Text variant="caption" color="muted">
          Verified on{' '}
          <FormattedDateTime datetime={domain.verified_at} dateStyle="long" />
        </Text>
      </Box>
    ))}
  </Box>
)

export default SSODomains
