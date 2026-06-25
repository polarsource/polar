'use client'

import { schemas } from '@polar-sh/client'
import { Avatar, Checkbox, SegmentedControl, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useEffect, useState } from 'react'

type AccessMode = 'all' | 'specific'

const OrganizationSelector = ({
  organizations,
  onValidityChange,
}: {
  organizations: schemas['AuthorizeOrganization'][]
  onValidityChange?: (valid: boolean) => void
}) => {
  const [mode, setMode] = useState<AccessMode>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // "Specific" requires at least one organization; "All" is always valid.
  useEffect(() => {
    onValidityChange?.(mode === 'all' || selected.size > 0)
  }, [mode, selected, onValidityChange])

  if (organizations.length === 0) {
    return null
  }

  const toggle = (id: string) => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <Box as="section" flexDirection="column" rowGap="m" marginBottom="l">
      <Box flexDirection="column" rowGap="xs">
        <Text variant="label">Organization access</Text>
        <Text variant="caption" color="muted">
          {mode === 'all'
            ? 'This token can access every organization you belong to, including ones you join later.'
            : 'This token can access only the organizations you select below.'}
        </Text>
      </Box>

      <SegmentedControl
        value={mode}
        onChange={setMode}
        options={[
          { value: 'all', label: 'All organizations' },
          { value: 'specific', label: 'Specific organizations' },
        ]}
      />

      {mode === 'specific' && (
        <Box
          flexDirection="column"
          borderRadius="m"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          overflow="hidden"
        >
          {organizations.map((organization, index) => (
            <Box
              as="label"
              key={organization.id}
              display="flex"
              alignItems="center"
              columnGap="m"
              paddingHorizontal="m"
              paddingVertical="m"
              borderTopWidth={index === 0 ? 0 : 1}
              borderStyle="solid"
              borderColor="border-primary"
              backgroundColor={{ hover: 'background-secondary' }}
              transitionProperty="colors"
              transitionDuration="fast"
              cursor={{ hover: 'pointer' }}
            >
              <Checkbox
                name="organizations"
                value={organization.id}
                checked={selected.has(organization.id)}
                onCheckedChange={() => toggle(organization.id)}
              />
              <Avatar
                className="h-6 w-6"
                avatar_url={organization.avatar_url}
                name={organization.slug}
              />
              <Text variant="label">{organization.slug}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

export default OrganizationSelector
