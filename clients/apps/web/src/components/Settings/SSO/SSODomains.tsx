import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Link from 'next/link'

type VerifiedDomain = schemas['OrganizationDomain'] & { verified_at: string }

export const isVerifiedDomain = (
  domain: schemas['OrganizationDomain'],
): domain is VerifiedDomain => domain.verified_at !== null

const SSODomains = ({
  organization,
  domains,
}: {
  organization: schemas['Organization']
  domains: VerifiedDomain[]
}) => {
  if (domains.length === 0) {
    return (
      <Text variant="caption" color="muted">
        <Link
          href={`/dashboard/${organization.slug}/settings#domains`}
          className="underline"
        >
          Verify your email domain
        </Link>{' '}
        so members signing in with it go straight to SSO.
      </Text>
    )
  }

  return (
    <Box flexDirection="column" gap="xs">
      <Text variant="label">Domains</Text>
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
}

export default SSODomains
