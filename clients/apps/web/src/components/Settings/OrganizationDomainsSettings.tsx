import {
  useCreateOrganizationDomain,
  useDeleteOrganizationDomain,
  useOrganizationDomains,
  useVerifyOrganizationDomain,
} from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { Button } from '@polar-sh/orbit/Button'
import { Input } from '@polar-sh/orbit/Input'
import { Text } from '@polar-sh/orbit/Text'
import { X } from '@polar-sh/orbit/icons'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { useState } from 'react'
import { toast } from '../Toast/use-toast'
import { DomainDnsRecord } from './DomainDnsRecord'
import { SettingsGroup, SettingsGroupItem } from './SettingsGroup'

interface Props {
  organization: schemas['Organization']
}

const OrganizationDomainsSettings = ({ organization }: Props) => {
  const [draft, setDraft] = useState('')
  const { data: domains } = useOrganizationDomains(organization.id)
  const createDomain = useCreateOrganizationDomain(organization.id)
  const verifyDomain = useVerifyOrganizationDomain(organization.id)
  const deleteDomain = useDeleteOrganizationDomain(organization.id)

  const add = async () => {
    const { error } = await createDomain.mutateAsync({ domain: draft })
    if (error) {
      toast({
        title: 'Failed to add domain',
        description: extractApiErrorMessage(error, 'Please try again.'),
      })
      return
    }
    setDraft('')
  }

  const verify = async (domainId: string) => {
    const { error } = await verifyDomain.mutateAsync(domainId)
    if (error) {
      toast({
        title: 'Domain not verified yet',
        description: extractApiErrorMessage(error, 'Please try again.'),
      })
    }
  }

  const remove = async (domainId: string) => {
    const { error } = await deleteDomain.mutateAsync(domainId)
    if (error) {
      toast({
        title: 'Failed to remove domain',
        description: extractApiErrorMessage(error, 'Please try again.'),
      })
    }
  }

  const items = domains?.items ?? []

  return (
    <SettingsGroup>
      <SettingsGroupItem
        title="Domains"
        description="Prove you own a domain by adding a DNS TXT record."
        layout="stacked"
      >
        <Box flexDirection="column" gap="m" width="100%">
          {items.length > 0 ? (
            <Box as="ul" flexDirection="column" gap="xs">
              {items.map((domain) => (
                <Box
                  as="li"
                  key={domain.id}
                  display="flex"
                  flexDirection="column"
                  gap="m"
                  paddingVertical="s"
                  paddingHorizontal="m"
                  backgroundColor="background-card"
                  borderRadius="s"
                >
                  <Box alignItems="center" justifyContent="between" gap="m">
                    <Box flexDirection="column">
                      <Text variant="body">{domain.domain}</Text>
                      <Text variant="caption" color="muted">
                        {domain.verified_at ? (
                          <>
                            Verified on{' '}
                            <FormattedDateTime
                              datetime={domain.verified_at}
                              dateStyle="long"
                            />
                          </>
                        ) : (
                          'Pending verification'
                        )}
                      </Text>
                    </Box>
                    <Box alignItems="center" gap="xs">
                      {domain.verified_at ? null : (
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => verify(domain.id)}
                          loading={
                            verifyDomain.isPending &&
                            verifyDomain.variables === domain.id
                          }
                        >
                          Verify
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        aria-label={`Remove ${domain.domain}`}
                        onClick={() => remove(domain.id)}
                        loading={
                          deleteDomain.isPending &&
                          deleteDomain.variables === domain.id
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </Box>
                  </Box>
                  {domain.verified_at ? null : (
                    <DomainDnsRecord domain={domain} />
                  )}
                </Box>
              ))}
            </Box>
          ) : null}

          <Box gap="s" alignItems="start">
            <Input
              value={draft}
              aria-label="Domain"
              placeholder="example.com"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !createDomain.isPending) {
                  e.preventDefault()
                  add()
                }
              }}
            />
            <Button
              type="button"
              onClick={add}
              disabled={draft.trim().length === 0}
              loading={createDomain.isPending}
            >
              Add
            </Button>
          </Box>

          <Text variant="caption" color="muted">
            Keep the TXT record in place once verified: Polar checks it again
            during reviews.
          </Text>
        </Box>
      </SettingsGroupItem>
    </SettingsGroup>
  )
}

export default OrganizationDomainsSettings
