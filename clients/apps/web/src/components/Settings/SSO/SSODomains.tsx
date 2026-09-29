import { useSSODomains } from '@/hooks/queries'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'

const SSODomains = ({ organizationId }: { organizationId: string }) => {
  const domains = useSSODomains(organizationId)
  const items = domains.data?.items ?? []

  if (domains.isLoading || domains.isError) {
    return null
  }

  if (items.length === 0) {
    return (
      <Text variant="caption" color="muted">
        Contact Polar to register your email domain, so members signing in with
        it go straight to SSO.
      </Text>
    )
  }

  return (
    <Box flexDirection="column" gap="xs">
      <Text variant="label">Domains</Text>
      {items.map((domain) => (
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
