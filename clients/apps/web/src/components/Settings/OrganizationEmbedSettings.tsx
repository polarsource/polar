import {
  useOrganizationEmbedStatus,
  useUpdateOrganization,
} from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { Button } from '@polar-sh/orbit/Button'
import { Input } from '@polar-sh/orbit/Input'
import { Text } from '@polar-sh/orbit/Text'
import { X } from 'lucide-react'
import React, { useCallback, useState } from 'react'
import { toast } from '../Toast/use-toast'
import OrganizationEmbedUncoveredHosts from './OrganizationEmbedUncoveredHosts'
import { SettingsGroup, SettingsGroupItem } from './SettingsGroup'

const NO_HOSTS: schemas['OrganizationUncoveredHost'][] = []
const NO_SHARED: string[] = []

interface OrganizationEmbedSettingsProps {
  organization: schemas['Organization']
  readOnly: boolean
}

const OrganizationEmbedSettings: React.FC<OrganizationEmbedSettingsProps> = ({
  organization,
  readOnly,
}) => {
  const [hosts, setHosts] = useState<string[]>(organization.embed_hosts)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const updateOrganization = useUpdateOrganization()
  const { data: embedStatus } = useOrganizationEmbedStatus(organization.id)
  const shared = embedStatus?.shared_hosts ?? NO_SHARED

  const save = useCallback(
    async (embed_hosts: string[]) => {
      setError(null)
      const { data, error } = await updateOrganization.mutateAsync({
        id: organization.id,
        body: { embed_hosts },
      })

      if (error) {
        const message = extractApiErrorMessage(error)
        setError(message)
        toast({
          title: 'Embedding settings update failed',
          description: message,
        })
        return false
      }

      setHosts(data.embed_hosts)
      return true
    },
    [organization.id, updateOrganization],
  )

  const add = useCallback(async () => {
    const entries = draft.split(/[\s,]+/).filter(Boolean)
    if (entries.length === 0) {
      return
    }
    if (await save([...hosts, ...entries])) {
      setDraft('')
    }
  }, [draft, hosts, save])

  const remove = useCallback(
    (entry: string) => save(hosts.filter((host) => host !== entry)),
    [hosts, save],
  )

  const addSuggested = useCallback(
    (entries: string[]) => save([...hosts, ...entries]),
    [hosts, save],
  )

  return (
    <SettingsGroup>
      <SettingsGroupItem
        title={
          shared.length === 0 ? (
            'Embed hosts'
          ) : (
            <Box as="span" display="inline-flex" alignItems="center" gap="s">
              Embed hosts
              <Text variant="caption" color="warning">
                {shared.length === 1
                  ? '1 host is too broad'
                  : `${shared.length} hosts are too broad`}
              </Text>
            </Box>
          )
        }
        description={
          organization.embed_hosts_enforced
            ? 'Only these hosts can embed your checkout.'
            : 'Only these hosts will be able to embed your checkout once we enforce the list. Nothing changes until then.'
        }
        vertical
      >
        <Box flexDirection="column" gap="m" width="100%">
          {hosts.length > 0 ? (
            <Box
              as="ul"
              flexDirection="column"
              gap="xs"
              maxHeight={320}
              overflowY="auto"
            >
              {hosts.map((host) => (
                <Box
                  as="li"
                  key={host}
                  display="flex"
                  alignItems="center"
                  justifyContent="between"
                  gap="m"
                  paddingVertical="s"
                  paddingHorizontal="m"
                  backgroundColor="background-card"
                  borderRadius="s"
                >
                  <Box flexDirection="column">
                    <Text variant="body">{host}</Text>
                    {shared.includes(host) ? (
                      <Text variant="caption" color="warning">
                        {`${host.replace('*.', '')} hosts other people's sites. Any of them can embed your checkout.`}
                      </Text>
                    ) : null}
                  </Box>
                  {readOnly ? null : (
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      aria-label={`Remove ${host}`}
                      onClick={() => remove(host)}
                      loading={updateOrganization.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </Box>
              ))}
            </Box>
          ) : null}

          {readOnly ? null : (
            <OrganizationEmbedUncoveredHosts
              hosts={embedStatus?.uncovered_hosts ?? NO_HOSTS}
              onAdd={addSuggested}
              pending={updateOrganization.isPending}
            />
          )}

          {readOnly ? null : (
            <Box gap="s" alignItems="start">
              <Input
                value={draft}
                aria-label="Embed hosts"
                placeholder="example.com, *.example.com"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !updateOrganization.isPending) {
                    e.preventDefault()
                    add()
                  }
                }}
              />
              <Button
                type="button"
                onClick={add}
                disabled={draft.trim().length === 0}
                loading={updateOrganization.isPending}
              >
                Add
              </Button>
            </Box>
          )}

          {error === null ? null : (
            <Text variant="caption" color="danger">
              {error}
            </Text>
          )}

          <Text variant="caption" color="muted">
            Add every host at once, separated by commas or spaces. Write each
            host on its own, without a scheme: example.com, *.example.com for
            any subdomain, or localhost:3000 with a port. HTTPS is always
            allowed, and HTTP too on localhost and private addresses.
          </Text>
        </Box>
      </SettingsGroupItem>
    </SettingsGroup>
  )
}

export default OrganizationEmbedSettings
