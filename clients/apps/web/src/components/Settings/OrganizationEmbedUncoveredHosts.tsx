import { schemas } from '@polar-sh/client'
import { Checkbox } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Button } from '@polar-sh/orbit/Button'
import { Text } from '@polar-sh/orbit/Text'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import React, { useCallback, useState } from 'react'

interface OrganizationEmbedUncoveredHostsProps {
  hosts: schemas['OrganizationUncoveredHost'][]
  onAdd: (hosts: string[]) => Promise<boolean>
  pending: boolean
}

const OrganizationEmbedUncoveredHosts: React.FC<
  OrganizationEmbedUncoveredHostsProps
> = ({ hosts, onAdd, pending }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // A host added elsewhere leaves the list, and its selection stops counting.
  const chosen = hosts
    .filter((host) => selected.has(host.host))
    .map((host) => host.host)

  const add = useCallback(async () => {
    if (await onAdd(chosen)) {
      setSelected(new Set())
    }
  }, [chosen, onAdd])

  const toggle = useCallback((host: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (!next.delete(host)) {
        next.add(host)
      }
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelected((current) =>
      hosts.every((host) => current.has(host.host))
        ? new Set()
        : new Set(hosts.map((host) => host.host)),
    )
  }, [hosts])

  if (hosts.length === 0) {
    return null
  }

  return (
    <Box flexDirection="column" gap="s">
      <Text variant="caption" color="muted">
        Seen embedding your checkout over the last 90 days, and not covered by
        your list. Anyone can name an origin when they open a checkout, so add
        only the ones you recognise.
      </Text>

      <Box alignItems="center" gap="s">
        <Checkbox
          checked={
            chosen.length === hosts.length
              ? true
              : chosen.length === 0
                ? false
                : 'indeterminate'
          }
          onCheckedChange={toggleAll}
          aria-label="Select every host"
        />
        <Text variant="caption" color="muted">
          {hosts.length} hosts, most used first
        </Text>
      </Box>

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
            key={host.host}
            display="flex"
            alignItems="center"
            gap="m"
            paddingVertical="s"
            paddingHorizontal="m"
            backgroundColor="background-card"
            borderRadius="s"
          >
            <Checkbox
              checked={selected.has(host.host)}
              onCheckedChange={() => toggle(host.host)}
              aria-label={`Select ${host.host}`}
            />
            <Box flexDirection="column">
              <Text variant="body">{host.host}</Text>
              <Text variant="caption" color="muted">
                {host.checkouts === 1
                  ? '1 checkout'
                  : `${host.checkouts} checkouts`}
                , last on{' '}
                <FormattedDateTime
                  datetime={host.last_seen_at}
                  dateStyle="medium"
                />
              </Text>
            </Box>
          </Box>
        ))}
      </Box>

      <Box>
        <Button
          type="button"
          onClick={add}
          disabled={chosen.length === 0}
          loading={pending}
        >
          {chosen.length === 1 ? 'Add 1 host' : `Add ${chosen.length} hosts`}
        </Button>
      </Box>
    </Box>
  )
}

export default OrganizationEmbedUncoveredHosts
