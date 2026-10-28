'use client'

import { DomainDnsRecord } from '@/components/Settings/DomainDnsRecord'
import { toast } from '@/components/Toast/use-toast'
import {
  useCreateOrganizationDomain,
  useOrganizationDomains,
  useVerifyOrganizationDomain,
} from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { Button, Pill, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

interface Props {
  organization: schemas['Organization']
}

const websiteHost = (website: string): string | null => {
  try {
    return new URL(website).hostname
  } catch {
    return null
  }
}

export const WebsiteDomainVerification = ({ organization }: Props) => {
  const { data: domains } = useOrganizationDomains(organization.id)
  const createDomain = useCreateOrganizationDomain(organization.id)
  const verifyDomain = useVerifyOrganizationDomain(organization.id)

  const host = organization.website ? websiteHost(organization.website) : null
  if (!host || !domains) return null

  const matching = domains.items.filter(
    (d) => host === d.domain || host.endsWith(`.${d.domain}`),
  )
  const domain = matching.find((d) => d.verified_at) ?? matching[0]
  const domainName = domain?.domain ?? host.replace(/^www\./, '')

  const onAdd = async () => {
    const { error } = await createDomain.mutateAsync({ domain: domainName })
    if (error) {
      toast({
        title: 'Failed to add domain',
        description: extractApiErrorMessage(error, 'Please try again.'),
      })
    }
  }

  const onVerify = async (domainId: string) => {
    const { error } = await verifyDomain.mutateAsync(domainId)
    if (error) {
      toast({
        title: 'Domain not verified yet',
        description: extractApiErrorMessage(error, 'Please try again.'),
      })
    }
  }

  return (
    <Box
      flexDirection="column"
      rowGap="m"
      marginTop="m"
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      paddingTop="m"
    >
      <Box alignItems="center" columnGap="s">
        <Text variant="label">Verify your domain</Text>
        {domain?.verified_at ? (
          <Pill color="green">Verified</Pill>
        ) : (
          <Pill color="gray">Optional</Pill>
        )}
      </Box>
      {domain?.verified_at ? (
        <Text color="muted">
          {domain.domain} is verified. Keep the TXT record in place: Polar
          checks it again during reviews.
        </Text>
      ) : domain ? (
        <>
          <Text color="muted">
            Add this TXT record to the DNS of {domain.domain}, then verify.
          </Text>
          <DomainDnsRecord domain={domain} />
          <Box justifyContent="end">
            <Button
              type="button"
              size="sm"
              loading={verifyDomain.isPending}
              onClick={() => onVerify(domain.id)}
            >
              Verify
            </Button>
          </Box>
        </>
      ) : (
        <Box alignItems="center" justifyContent="between" columnGap="s">
          <Text color="muted">
            Prove you own {domainName} by adding a DNS TXT record.
          </Text>
          <Button
            type="button"
            size="sm"
            loading={createDomain.isPending}
            onClick={onAdd}
          >
            Get DNS record
          </Button>
        </Box>
      )}
    </Box>
  )
}
