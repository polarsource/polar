'use client'

import { schemas } from '@polar-sh/client'
import {
  Avatar,
  Checkbox,
  SegmentedControl,
  Switch,
  Text,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useEffect, useState } from 'react'

type AccessMode = 'all' | 'specific'

const OrganizationSelector = ({
  organizations,
  singleSelect = false,
  onValidityChange,
}: {
  organizations: schemas['AuthorizeOrganization'][]
  // sub_type=organization issues a user token forced to one org: lock to
  // "specific", pick exactly one with radios, and require a selection.
  singleSelect?: boolean
  onValidityChange?: (valid: boolean) => void
}) => {
  const [mode, setMode] = useState<AccessMode>(
    singleSelect ? 'specific' : 'all',
  )
  // A single radio option leaves nothing to choose, so preselect it.
  const [selected, setSelected] = useState<Set<string>>(() =>
    singleSelect && organizations.length === 1
      ? new Set([organizations[0].id])
      : new Set(),
  )
  // "All" is always valid; "specific" (and single-select) requires a selection.
  useEffect(() => {
    onValidityChange?.(mode === 'all' || selected.size > 0)
  }, [mode, selected, onValidityChange])

  const select = (id: string) => {
    if (singleSelect) {
      setSelected(new Set([id]))
      return
    }
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
      {!singleSelect && organizations.length > 0 && (
        <SegmentedControl
          value={mode}
          onChange={setMode}
          size="lg"
          options={[
            { value: 'all', label: 'All organizations' },
            { value: 'specific', label: 'Specific organizations' },
          ]}
        />
      )}

      {mode === 'specific' && organizations.length > 0 && (
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
              <Avatar
                className="h-8 w-8"
                avatar_url={organization.avatar_url}
                name={organization.name || organization.slug}
              />
              <Text>{organization.name || organization.slug}</Text>
              <div className="ml-auto">
                {singleSelect ? (
                  <input
                    type="radio"
                    name="organizations"
                    value={organization.id}
                    checked={selected.has(organization.id)}
                    onChange={() => select(organization.id)}
                    className="h-4 w-4 accent-black dark:accent-white"
                  />
                ) : (
                  <Switch
                    name="organizations"
                    value={organization.id}
                    checked={selected.has(organization.id)}
                    onCheckedChange={() => select(organization.id)}
                  />
                )}
              </div>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

export default OrganizationSelector
